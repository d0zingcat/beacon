import { describe, expect, it } from 'vitest';
import { parseKimiBlogHtml } from './kimi-blog';

const HERO_CARD = `
<div class="menu-card group relative flex flex-col p-2 rounded-xl menu-card-hero-mobile">
  <a href="/blog/kimi-k2-6" aria-label="Kimi K2.6" class="absolute inset-0 z-[1] rounded-xl"></a>
  <div class="card-media"><img alt="Kimi K2.6" src="https://kimi-file.moonshot.cn/x" loading="lazy"/></div>
  <div class="flex flex-col gap-2.5 px-4 pb-2 mt-4 card-body">
    <h4 class="card-title text-xl font-semibold">Kimi K2.6</h4>
    <p class="card-desc text-base">Advancing Open-Source Coding</p>
    <p class="card-date text-base">2026/04/20</p>
  </div>
</div>
`;

const LIST_CARD = `
<div class="menu-card group relative flex flex-col p-2 rounded-xl">
  <a href="/blog/agent-swarm" aria-label="Agent Swarm" class="absolute inset-0 z-[1] rounded-xl"></a>
  <div class="card-media"><img alt="Agent Swarm" src="https://kimi-file.moonshot.cn/y"/></div>
  <div class="flex flex-col gap-2.5 px-4 pb-2 mt-4 card-body">
    <h4 class="card-title text-xl font-semibold">Agent Swarm</h4>
    <p class="card-date text-base">2026/02/09</p>
  </div>
</div>
`;

const EXTERNAL_CARD = `
<div class="menu-card group relative flex flex-col p-2 rounded-xl">
  <a href="https://github.com/MoonshotAI/Kimi-Dev" aria-label="Kimi-Dev" class="absolute inset-0 z-[1] rounded-xl"></a>
  <div class="card-media"><img alt="Kimi-Dev" src="https://kimi-file.moonshot.cn/z"/></div>
  <div class="flex flex-col gap-2.5 px-4 pb-2 mt-4 card-body">
    <h4 class="card-title text-xl font-semibold">Kimi-Dev</h4>
    <p class="card-date text-base">2025/06/17</p>
  </div>
</div>
`;

const NAV_DROPDOWN = `
<a href="https://www.kimi.com/blog/kimi-k2-6" class="flex items-center gap-3 rounded-md p-2">
  <div class="flex flex-col whitespace-nowrap">
    <span class="text-sm">Kimi K2.6</span>
    <span class="text-sm">Advancing Open-Source Coding</span>
  </div>
</a>
`;

describe('parseKimiBlogHtml', () => {
	it('parses an in-site blog card with summary and date', () => {
		const items = parseKimiBlogHtml(HERO_CARD);
		expect(items).toEqual([
			{
				externalId: 'kimi-k2-6',
				url: 'https://www.kimi.com/blog/kimi-k2-6',
				title: 'Kimi K2.6',
				summary: 'Advancing Open-Source Coding',
				publishedAt: new Date('2026-04-20T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('parses a list card without summary', () => {
		const items = parseKimiBlogHtml(LIST_CARD);
		expect(items).toEqual([
			{
				externalId: 'agent-swarm',
				url: 'https://www.kimi.com/blog/agent-swarm',
				title: 'Agent Swarm',
				summary: undefined,
				publishedAt: new Date('2026-02-09T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('parses external research links using the full url as externalId', () => {
		const items = parseKimiBlogHtml(EXTERNAL_CARD);
		expect(items).toEqual([
			{
				externalId: 'https://github.com/MoonshotAI/Kimi-Dev',
				url: 'https://github.com/MoonshotAI/Kimi-Dev',
				title: 'Kimi-Dev',
				summary: undefined,
				publishedAt: new Date('2025-06-17T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('ignores the nav dropdown anchors (no absolute inset-0 class)', () => {
		const items = parseKimiBlogHtml(NAV_DROPDOWN);
		expect(items).toHaveLength(0);
	});

	it('dedupes the hero card and the first list card when both reference the same slug', () => {
		const items = parseKimiBlogHtml(HERO_CARD + HERO_CARD + LIST_CARD);
		expect(items).toHaveLength(2);
		expect(items.map((i) => i.externalId).sort()).toEqual(['agent-swarm', 'kimi-k2-6']);
	});

	it('parses the full mixed listing', () => {
		const items = parseKimiBlogHtml(HERO_CARD + LIST_CARD + EXTERNAL_CARD + NAV_DROPDOWN);
		expect(items).toHaveLength(3);
		expect(items.find((i) => i.externalId === 'kimi-k2-6')?.summary).toBe('Advancing Open-Source Coding');
		expect(items.find((i) => i.externalId === 'https://github.com/MoonshotAI/Kimi-Dev')?.url).toBe(
			'https://github.com/MoonshotAI/Kimi-Dev',
		);
	});
});
