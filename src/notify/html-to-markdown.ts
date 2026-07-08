/**
 * Minimal HTML-fragment → Markdown converter for RSS descriptions.
 *
 * Scope: RSS `<description>` payloads are usually a slice of body HTML
 * (no `<html>`/`<body>` root, may contain `<style>`/`<script>`/loose `<div>`).
 * We map a small whitelist of tags to Feishu card markdown and strip the rest
 * (keeping inner text where it makes sense), so the rendered card resembles the
 * original article without shipping a DOM dependency on Workers.
 *
 * Not a general-purpose HTML→Markdown engine: unknown tags pass their text
 * through, and malformed input degrades to plain text rather than throwing.
 */

interface ElementNode {
	type: 'element';
	tag: string;
	attrs: Record<string, string>;
	children: Node[];
}

interface TextNode {
	type: 'text';
	text: string;
}

type Node = ElementNode | TextNode;

const VOID_TAGS = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);

/** Tags whose entire subtree is dropped (content + markup). */
const DROP_SUBTREE_TAGS = new Set(['script', 'style', 'head', 'noscript', 'iframe', 'svg']);

export function htmlToMarkdown(html: string): string {
	const nodes = parseFragment(html);
	const md = renderChildren(nodes, { inCode: false });
	return tidy(md);
}

function parseFragment(html: string): Node[] {
	const nodes: Node[] = [];
	let i = 0;
	const len = html.length;

	while (i < len) {
		if (html[i] === '<') {
			// Comment
			if (html.startsWith('<!--', i)) {
				const end = html.indexOf('-->', i + 4);
				i = end === -1 ? len : end + 3;
				continue;
			}
			// CDATA → text node
			if (html.startsWith('<![CDATA[', i)) {
				const end = html.indexOf(']]>', i + 9);
				const text = end === -1 ? html.slice(i + 9) : html.slice(i + 9, end);
				nodes.push({ type: 'text', text });
				i = end === -1 ? len : end + 3;
				continue;
			}
			// DOCTYPE / processing instruction
			if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
				const end = html.indexOf('>', i);
				i = end === -1 ? len : end + 1;
				continue;
			}
			const tagMatch = matchTag(html, i);
			if (!tagMatch) {
				// Stray '<', treat as text
				nodes.push({ type: 'text', text: html[i] ?? '' });
				i += 1;
				continue;
			}
			const { tag, attrs, selfClosing, rawLength } = tagMatch;
			const lowerTag = tag.toLowerCase();

			if (DROP_SUBTREE_TAGS.has(lowerTag)) {
				// Skip to matching close tag (case-insensitive)
				const closeRe = new RegExp(`</${lowerTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*>`, 'i');
				const rest = html.slice(i + rawLength);
				const closeMatch = rest.search(closeRe);
				i = closeMatch === -1 ? len : i + rawLength + closeMatch + rest.slice(closeMatch).match(closeRe)![0].length;
				continue;
			}

			if (selfClosing || VOID_TAGS.has(lowerTag)) {
				nodes.push({ type: 'element', tag: lowerTag, attrs, children: [] });
				i += rawLength;
				continue;
			}

			const { node, consumed } = parseElementChildren(html, i, tagMatch);
			nodes.push(node);
			i += consumed;
		} else {
			const next = html.indexOf('<', i);
			const text = next === -1 ? html.slice(i) : html.slice(i, next);
			if (text) nodes.push({ type: 'text', text });
			i = next === -1 ? len : next;
		}
	}
	return nodes;
}

interface TagMatch {
	tag: string;
	attrs: Record<string, string>;
	selfClosing: boolean;
	rawLength: number;
}

function matchTag(html: string, start: number): TagMatch | null {
	const end = html.indexOf('>', start);
	if (end === -1) return null;
	const raw = html.slice(start, end + 1);
	const inner = raw.slice(1, -1); // strip < >
	const selfClosing = inner.endsWith('/');
	const body = selfClosing ? inner.slice(0, -1) : inner;
	const nameMatch = body.match(/^([a-zA-Z][a-zA-Z0-9:-]*)/);
	if (!nameMatch) return null;
	const tag = nameMatch[1];
	const attrs = parseAttrs(body.slice(nameMatch[1].length));
	return { tag, attrs, selfClosing, rawLength: raw.length };
}

function parseAttrs(attrString: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	const re = /\s*([a-zA-Z_:][a-zA-Z0-9:_.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(attrString)) !== null) {
		const name = m[1].toLowerCase();
		const value = m[2] ?? m[3] ?? m[4] ?? '';
		attrs[name] = decodeEntities(value);
	}
	return attrs;
}

function parseElementChildren(html: string, start: number, open: TagMatch): { node: ElementNode; consumed: number } {
	const openEnd = start + open.rawLength;
	const tag = open.tag;
	const closeRe = new RegExp(`</${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*>`, 'i');

	const stack: { tag: string; attrs: Record<string, string>; children: Node[] }[] = [{ tag, attrs: open.attrs, children: [] }];
	let i = openEnd;

	while (i < html.length) {
		if (html[i] === '<') {
			if (html.startsWith('<!--', i)) {
				const end = html.indexOf('-->', i + 4);
				i = end === -1 ? html.length : end + 3;
				continue;
			}
			if (html.startsWith('<![CDATA[', i)) {
				const end = html.indexOf(']]>', i + 9);
				const text = end === -1 ? html.slice(i + 9) : html.slice(i + 9, end);
				stack[stack.length - 1].children.push({ type: 'text', text });
				i = end === -1 ? html.length : end + 3;
				continue;
			}
			const closeMatch = html.slice(i).match(closeRe);
			if (closeMatch && closeMatch.index === 0) {
				const closed = stack.pop()!;
				const node: ElementNode = { type: 'element', tag: closed.tag, attrs: closed.attrs, children: closed.children };
				if (stack.length === 0) {
					return { node, consumed: i + closeMatch[0].length - start };
				}
				stack[stack.length - 1].children.push(node);
				i += closeMatch[0].length;
				continue;
			}
			const tagMatch = matchTag(html, i);
			if (!tagMatch) {
				stack[stack.length - 1].children.push({ type: 'text', text: html[i] ?? '' });
				i += 1;
				continue;
			}
			const lowerTag = tagMatch.tag.toLowerCase();
			if (DROP_SUBTREE_TAGS.has(lowerTag)) {
				const subCloseRe = new RegExp(`</${lowerTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*>`, 'i');
				const rest = html.slice(i + tagMatch.rawLength);
				const subClose = rest.search(subCloseRe);
				i = subClose === -1 ? html.length : i + tagMatch.rawLength + subClose + rest.slice(subClose).match(subCloseRe)![0].length;
				continue;
			}
			if (tagMatch.selfClosing || VOID_TAGS.has(lowerTag)) {
				stack[stack.length - 1].children.push({ type: 'element', tag: lowerTag, attrs: tagMatch.attrs, children: [] });
				i += tagMatch.rawLength;
				continue;
			}
			// Non-close tag that doesn't match our current close: could be a sibling
			// open of a different tag, or a stray close of an ancestor. Treat as a
			// new child; parseElementChildren consumes its own matching close.
			const child = parseElementChildren(html, i, tagMatch);
			stack[stack.length - 1].children.push(child.node);
			i += child.consumed;
		} else {
			const next = html.indexOf('<', i);
			const text = next === -1 ? html.slice(i) : html.slice(i, next);
			if (text) stack[stack.length - 1].children.push({ type: 'text', text });
			i = next === -1 ? html.length : next;
		}
	}

	// Unclosed element: flush what we have.
	const top = stack[0];
	return {
		node: { type: 'element', tag: top.tag, attrs: top.attrs, children: top.children },
		consumed: html.length - start,
	};
}

// parseElementChildren returns consumed relative to `start`; the recursive call
// passes `i` as its own start, so consumed is already absolute offset from i.
function startOfChild(_html: string, i: number): number {
	return i;
}

interface RenderCtx {
	inCode: boolean;
}

function renderChildren(nodes: Node[], ctx: RenderCtx): string {
	return nodes.map((n) => renderNode(n, ctx)).join('');
}

function renderNode(node: Node, ctx: RenderCtx): string {
	if (node.type === 'text') {
		return ctx.inCode ? node.text : inlineEscape(decodeEntities(node.text));
	}
	const tag = node.tag;
	switch (tag) {
		case 'br':
			return '\n';
		case 'hr':
			return '\n\n---\n\n';
		case 'wbr':
			return '';
		case 'img': {
			const alt = node.attrs.alt ?? '';
			const src = node.attrs.src ?? '';
			return src ? `![${alt}](${src})` : '';
		}
		case 'strong':
		case 'b':
			return `**${renderChildren(node.children, ctx).trim() || ''}**`;
		case 'em':
		case 'i':
			return `*${renderChildren(node.children, ctx).trim() || ''}*`;
		case 'del':
		case 's':
		case 'strike':
			return `~~${renderChildren(node.children, ctx).trim() || ''}~~`;
		case 'code':
			return `\`${textContent(node).replace(/`/g, '\\`')}\``;
		case 'pre': {
			const lang = pickCodeLang(node);
			const raw = textContent(node).replace(/\u00a0/g, ' ');
			return `\n\n\`\`\`${lang}\n${raw}\n\`\`\`\n\n`;
		}
		case 'a': {
			const href = node.attrs.href ?? '';
			const label = renderChildren(node.children, ctx).trim() || href;
			return href ? `[${label}](${href})` : label;
		}
		case 'h1':
			return `\n\n# ${renderChildren(node.children, ctx).trim()}\n\n`;
		case 'h2':
			return `\n\n## ${renderChildren(node.children, ctx).trim()}\n\n`;
		case 'h3':
			return `\n\n### ${renderChildren(node.children, ctx).trim()}\n\n`;
		case 'h4':
			return `\n\n#### ${renderChildren(node.children, ctx).trim()}\n\n`;
		case 'h5':
			return `\n\n##### ${renderChildren(node.children, ctx).trim()}\n\n`;
		case 'h6':
			return `\n\n###### ${renderChildren(node.children, ctx).trim()}\n\n`;
		case 'blockquote': {
			const inner = renderChildren(node.children, ctx).trim();
			const prefixed = inner
				.split('\n')
				.map((l) => (l ? `> ${l}` : '>'))
				.join('\n');
			return `\n\n${prefixed}\n\n`;
		}
		case 'ul':
			return `\n\n${renderList(node.children, ctx, false)}\n\n`;
		case 'ol':
			return `\n\n${renderList(node.children, ctx, true)}\n\n`;
		case 'li':
			// Standalone li (loose HTML) — render as a bullet.
			return `- ${renderChildren(node.children, ctx).trim()}\n`;
		case 'p':
		case 'div':
		case 'section':
		case 'article':
		case 'header':
		case 'footer':
		case 'main':
		case 'figure':
		case 'figcaption':
			return `\n\n${renderChildren(node.children, ctx).trim()}\n\n`;
		default:
			// Unknown / inline-only (span, sub, sup, small, mark, …): passthrough.
			return renderChildren(node.children, ctx);
	}
}

function renderList(children: Node[], ctx: RenderCtx, ordered: boolean): string {
	const items = children.filter((n): n is ElementNode => n.type === 'element' && n.tag === 'li');
	const lines: string[] = [];
	items.forEach((item, index) => {
		const bullet = ordered ? `${index + 1}.` : '-';
		const body = renderChildren(item.children, ctx)
			.trim()
			.replace(/\n{2,}/g, '\n');
		lines.push(`${bullet} ${body}`);
	});
	return lines.join('\n');
}

function textContent(node: Node): string {
	if (node.type === 'text') return decodeEntities(node.text);
	return node.children.map(textContent).join('');
}

function pickCodeLang(node: ElementNode): string {
	// <pre><code class="language-xxx"> is the common convention.
	const codeChild = node.children.find((n): n is ElementNode => n.type === 'element' && n.tag === 'code');
	const cls = (codeChild?.attrs.class ?? node.attrs.class ?? '').split(/\s+/);
	for (const c of cls) {
		const m = c.match(/^language-(.+)$/);
		if (m) return m[1];
	}
	return '';
}

function inlineEscape(text: string): string {
	// Escape characters that would otherwise start markdown constructs. Keep it
	// minimal so prose stays readable; backticks and emphasis markers are the
	// ones most likely to appear in RSS bodies and break rendering.
	return text.replace(/([`*_\[\]])/g, '\\$1');
}

const ENTITY_MAP: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
};

function decodeEntities(value: string): string {
	return value.replace(/&(?:#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z]+));/g, (match, hex, dec, name) => {
		if (hex) return String.fromCodePoint(parseInt(hex, 16));
		if (dec) return String.fromCodePoint(parseInt(dec, 10));
		return ENTITY_MAP[name] ?? match;
	});
}

function tidy(md: string): string {
	return md
		.replace(/\u00a0/g, ' ')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/^\s+|\s+$/g, '');
}
