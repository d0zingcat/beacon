import { createSource } from '../factory';
import type { RawItem } from '../types';

export const LONGCAT_SITE_URL = 'https://longcat.ai';
const USER_AGENT = 'beacon/1.0 (+https://github.com/d0zingcat/beacon)';

/**
 * Matches the SPA entry bundle, e.g.
 * `<script type="module" crossorigin src="//s3.meituan.net/.../assets/index-DnalR7lH.js">`.
 * The hash changes on every deploy, so it must be discovered from the homepage.
 */
const BUNDLE_SCRIPT_RE = /<script[^>]*\ssrc=["']([^"']*assets\/index-[A-Za-z0-9_-]+\.js)["']/i;

/**
 * Bilingual i18n entries shipped in the bundle, e.g.
 * `"research.card1.title":{zh:`...`,en:`...`}`. The card array references these
 * by key, so we collect both and resolve the English copy afterwards.
 */
const I18N_RE = /"research\.card(\d+)\.(title|desc)":\{zh:`([^`]*)`,en:`([^`]*)`\}/g;

/**
 * The "Latest Research" card array embedded in the bundle, e.g.
 * `{href:`https://longcat.ai/blog/longcat-2.0`,img:by,alt:`LongCat-2.0`,date:`2026-06-29`,titleKey:`research.card1.title`,descKey:`research.card1.desc`}`.
 * `img` is a variable reference (not a string literal), so it is matched as an identifier.
 */
const CARD_RE =
	/\{href:`([^`]*)`,img:[A-Za-z_$][\w$]*,alt:`[^`]*`,date:`([^`]*)`,titleKey:`research\.card(\d+)\.title`,descKey:`research\.card(\d+)\.desc`\}/g;

export interface LongcatResearchCard {
	href: string;
	date: string;
	cardIndex: string;
}

export interface LongcatI18nEntry {
	zh: string;
	en: string;
}

export function resolveLongcatBundleUrl(html: string): string | null {
	const match = html.match(BUNDLE_SCRIPT_RE);
	if (!match) return null;
	const src = match[1];
	if (src.startsWith('//')) return `https:${src}`;
	if (src.startsWith('http://') || src.startsWith('https://')) return src;
	if (src.startsWith('/')) return `${LONGCAT_SITE_URL}${src}`;
	return src;
}

export function parseLongcatI18n(js: string): Map<string, LongcatI18nEntry> {
	const map = new Map<string, LongcatI18nEntry>();
	const re = new RegExp(I18N_RE.source, 'g');
	let match: RegExpExecArray | null;
	while ((match = re.exec(js)) !== null) {
		map.set(`${match[1]}.${match[2]}`, { zh: match[3], en: match[4] });
	}
	return map;
}

export function parseLongcatCardArray(js: string): LongcatResearchCard[] {
	const cards: LongcatResearchCard[] = [];
	const re = new RegExp(CARD_RE.source, 'g');
	let match: RegExpExecArray | null;
	while ((match = re.exec(js)) !== null) {
		cards.push({ href: match[1], date: match[2], cardIndex: match[3] });
	}
	return cards;
}

function blogSlugFromHref(href: string): string | null {
	const match = href.match(/\/blog\/([^/?#]+)/);
	return match ? match[1] : null;
}

function parseLongcatDate(value: string): string | undefined {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return undefined;
	const iso = `${match[1]}-${match[2]}-${match[3]}`;
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

export function parseLongcatResearchBundle(js: string): RawItem[] {
	const i18n = parseLongcatI18n(js);
	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const card of parseLongcatCardArray(js)) {
		const title = i18n.get(`${card.cardIndex}.title`)?.en;
		if (!title) continue;

		const externalId = blogSlugFromHref(card.href) ?? card.href;
		if (seen.has(externalId)) continue;
		seen.add(externalId);

		items.push({
			externalId,
			url: card.href,
			title,
			summary: i18n.get(`${card.cardIndex}.desc`)?.en,
			publishedAt: parseLongcatDate(card.date),
		});
	}

	return items;
}

export async function fetchLongcatResearchList(fetchFn: typeof fetch): Promise<RawItem[]> {
	const homeResponse = await fetchFn(LONGCAT_SITE_URL, {
		headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
	});
	if (!homeResponse.ok) {
		throw new Error(`LongCat homepage fetch failed: ${homeResponse.status} ${homeResponse.statusText}`);
	}

	const bundleUrl = resolveLongcatBundleUrl(await homeResponse.text());
	if (!bundleUrl) {
		throw new Error('LongCat bundle script not found on homepage');
	}

	const bundleResponse = await fetchFn(bundleUrl, {
		headers: { 'user-agent': USER_AGENT, accept: 'text/javascript,*/*;q=0.8' },
	});
	if (!bundleResponse.ok) {
		throw new Error(`LongCat bundle fetch failed: ${bundleResponse.status} ${bundleResponse.statusText}`);
	}

	return parseLongcatResearchBundle(await bundleResponse.text());
}

createSource(
	{
		id: 'longcat-research',
		name: 'LongCat Research',
		mode: 'append',
	},
	{
		kind: 'webpage',
		extract(ctx) {
			return fetchLongcatResearchList(ctx.fetch);
		},
	},
);
