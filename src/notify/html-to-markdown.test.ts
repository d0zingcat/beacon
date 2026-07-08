import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from './html-to-markdown';

describe('htmlToMarkdown', () => {
	it('converts paragraphs and links', () => {
		const html = '<p>Hello <a href="https://example.com">world</a>!</p><p>Second para.</p>';
		expect(htmlToMarkdown(html)).toBe('Hello [world](https://example.com)!\n\nSecond para.');
	});

	it('converts emphasis and strong', () => {
		const html = '<p>This is <strong>bold</strong> and <em>italic</em>.</p>';
		expect(htmlToMarkdown(html)).toBe('This is **bold** and *italic*.');
	});

	it('converts headings', () => {
		expect(htmlToMarkdown('<h1>Title</h1><h2>Sub</h2>')).toBe('# Title\n\n## Sub');
	});

	it('converts unordered lists', () => {
		const html = '<ul><li>one</li><li>two</li></ul>';
		expect(htmlToMarkdown(html)).toBe('- one\n- two');
	});

	it('converts ordered lists with numbering', () => {
		const html = '<ol><li>first</li><li>second</li></ol>';
		expect(htmlToMarkdown(html)).toBe('1. first\n2. second');
	});

	it('converts blockquotes with line prefixing', () => {
		const html = '<blockquote>To be, or not to be.</blockquote>';
		expect(htmlToMarkdown(html)).toBe('> To be, or not to be.');
	});

	it('converts pre/code blocks with language hint', () => {
		const html = '<pre><code class="language-ts">const x = 1;</code></pre>';
		expect(htmlToMarkdown(html)).toBe('```ts\nconst x = 1;\n```');
	});

	it('converts inline code', () => {
		expect(htmlToMarkdown('<p>use <code>npm install</code> now</p>')).toBe('use `npm install` now');
	});

	it('drops script and style subtrees entirely', () => {
		const html = '<p>before</p><style>.a{color:red}</style><script>alert(1)</script><p>after</p>';
		expect(htmlToMarkdown(html)).toBe('before\n\nafter');
	});

	it('preserves inner text of unknown inline tags', () => {
		expect(htmlToMarkdown('<p>a <span>spanned</span> b</p>')).toBe('a spanned b');
	});

	it('handles nested same-name block tags', () => {
		const html = '<div>outer<div>inner</div>tail</div>';
		expect(htmlToMarkdown(html)).toBe('outer\n\ninner\n\ntail');
	});

	it('handles br as newline', () => {
		expect(htmlToMarkdown('<p>line1<br>line2</p>')).toBe('line1\nline2');
	});

	it('escapes markdown-meaningful characters in prose', () => {
		expect(htmlToMarkdown('<p>use a * or [x] mark</p>')).toBe('use a \\* or \\[x\\] mark');
	});

	it('decodes html entities', () => {
		expect(htmlToMarkdown('<p>tom &amp; jerry &lt;3</p>')).toBe('tom & jerry <3');
	});

	it('decodes cdata sections', () => {
		expect(htmlToMarkdown('<![CDATA[raw text]]>')).toBe('raw text');
	});

	it('strips comments', () => {
		expect(htmlToMarkdown('<p>a</p><!-- note --><p>b</p>')).toBe('a\n\nb');
	});

	it('collapses excessive whitespace and trims', () => {
		const html = '<div>  <p>hi</p>  </div>';
		expect(htmlToMarkdown(html)).toBe('hi');
	});

	it('degrades gracefully on malformed input', () => {
		expect(htmlToMarkdown('<p>unclosed')).toBe('unclosed');
		expect(htmlToMarkdown('just text')).toBe('just text');
		expect(htmlToMarkdown('')).toBe('');
	});

	it('handles images with alt and src', () => {
		expect(htmlToMarkdown('<img src="https://x/y.png" alt="diagram">')).toBe('![diagram](https://x/y.png)');
	});

	it('converts strikethrough', () => {
		expect(htmlToMarkdown('<p><del>gone</del></p>')).toBe('~~gone~~');
	});
});
