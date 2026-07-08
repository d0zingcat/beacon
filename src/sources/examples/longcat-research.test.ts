import { describe, expect, it } from 'vitest';
import {
	parseLongcatCardArray,
	parseLongcatI18n,
	parseLongcatResearchBundle,
	resolveLongcatBundleUrl,
} from './longcat-research';

const HOME_HTML = `
<!doctype html>
<html lang="zh-CN">
  <head>
    <title>LongCat - AI Coding Agent</title>
    <script type="module" crossorigin src="//s3.meituan.net/static-prod01/com.keetapp.friday.longcat.home/assets/index-DnalR7lH.js"></script>
  </head>
  <body><div id="app"></div></body>
</html>
`;

const BUNDLE_JS = `
"use strict";
window.owl("start",{project:"com.keetapp.friday.longcat.home"});
"research.section.title":{zh:"最新研究",en:"Latest Research"},
"research.tag":{zh:"文章",en:"Article"},
"research.card1.title":{zh:\`Introducing LongCat-2.0：万亿参数 MoE 大语言模型\`,en:\`Introducing LongCat-2.0: Trillion-Parameter MoE Large Language Model\`},
"research.card1.desc":{zh:\`1.6万亿参数 MoE 架构，支持 1M 超长上下文，基于国产超级节点训练，在编程与 Agent 任务上表现卓越。\`,en:\`1.6 trillion parameter MoE architecture with 1M long context, trained on domestic superpod accelerators, excelling in coding and agent tasks.\`},
"research.card2.title":{zh:\`GUI-CIDER：通过因果内化与密度感知重采样进行 GUI Agent 中期训练\`,en:\`GUI-CIDER: GUI Agent Mid-Training via Causal Internalization and Density-Aware Resampling\`},
"research.card2.desc":{zh:\`提出 GUI-CIDER 中期训练方法\`,en:\`Proposes GUI-CIDER mid-training method that explicitly internalizes GUI world knowledge into models through causal internalization and density-aware sample reselection.\`},
"research.card3.title":{zh:\`Learning to Act under Noise：通过噪声环境增强 Agent 鲁棒性\`,en:\`Learning to Act under Noise: Enhancing Agent Robustness via Noisy Environments\`},
"research.card3.desc":{zh:\`识别了用户噪声和工具噪声两大交互噪声来源\`,en:\`Identifies user noise and tool noise as two major sources of interaction noise, proposing training in noisy environments to enhance LLM agent robustness.\`}
let n=[{href:\`https://longcat.ai/blog/longcat-2.0\`,img:by,alt:\`LongCat-2.0\`,date:\`2026-06-29\`,titleKey:\`research.card1.title\`,descKey:\`research.card1.desc\`},{href:\`https://huggingface.co/papers/2605.28534\`,img:xy,alt:\`GUI-CIDER Pipeline\`,date:\`2026-05-27\`,titleKey:\`research.card2.title\`,descKey:\`research.card2.desc\`},{href:\`https://huggingface.co/papers/2605.27209\`,img:Sy,alt:\`NoisyAgent Overview\`,date:\`2026-05-26\`,titleKey:\`research.card3.title\`,descKey:\`research.card3.desc\`}];
`;

describe('resolveLongcatBundleUrl', () => {
	it('extracts the protocol-relative module script and prepends https', () => {
		expect(resolveLongcatBundleUrl(HOME_HTML)).toBe(
			'https://s3.meituan.net/static-prod01/com.keetapp.friday.longcat.home/assets/index-DnalR7lH.js',
		);
	});

	it('returns null when no bundle script is present', () => {
		expect(resolveLongcatBundleUrl('<html><body>no scripts</body></html>')).toBeNull();
	});
});

describe('parseLongcatI18n', () => {
	it('collects title and desc entries keyed by card index', () => {
		const i18n = parseLongcatI18n(BUNDLE_JS);
		expect(i18n.get('1.title')?.en).toBe('Introducing LongCat-2.0: Trillion-Parameter MoE Large Language Model');
		expect(i18n.get('1.title')?.zh).toBe('Introducing LongCat-2.0：万亿参数 MoE 大语言模型');
		expect(i18n.get('2.desc')?.en).toMatch(/^Proposes GUI-CIDER/);
		expect(i18n.get('3.title')?.en).toBe('Learning to Act under Noise: Enhancing Agent Robustness via Noisy Environments');
	});
});

describe('parseLongcatCardArray', () => {
	it('extracts href, date, and card index for each research card', () => {
		const cards = parseLongcatCardArray(BUNDLE_JS);
		expect(cards).toEqual([
			{ href: 'https://longcat.ai/blog/longcat-2.0', date: '2026-06-29', cardIndex: '1' },
			{ href: 'https://huggingface.co/papers/2605.28534', date: '2026-05-27', cardIndex: '2' },
			{ href: 'https://huggingface.co/papers/2605.27209', date: '2026-05-26', cardIndex: '3' },
		]);
	});
});

describe('parseLongcatResearchBundle', () => {
	it('maps cards to raw items using English copy and ISO publishedAt', () => {
		const items = parseLongcatResearchBundle(BUNDLE_JS);
		expect(items).toEqual([
			{
				externalId: 'longcat-2.0',
				url: 'https://longcat.ai/blog/longcat-2.0',
				title: 'Introducing LongCat-2.0: Trillion-Parameter MoE Large Language Model',
				summary: '1.6 trillion parameter MoE architecture with 1M long context, trained on domestic superpod accelerators, excelling in coding and agent tasks.',
				publishedAt: new Date('2026-06-29T00:00:00.000Z').toISOString(),
			},
			{
				externalId: 'https://huggingface.co/papers/2605.28534',
				url: 'https://huggingface.co/papers/2605.28534',
				title: 'GUI-CIDER: GUI Agent Mid-Training via Causal Internalization and Density-Aware Resampling',
				summary: 'Proposes GUI-CIDER mid-training method that explicitly internalizes GUI world knowledge into models through causal internalization and density-aware sample reselection.',
				publishedAt: new Date('2026-05-27T00:00:00.000Z').toISOString(),
			},
			{
				externalId: 'https://huggingface.co/papers/2605.27209',
				url: 'https://huggingface.co/papers/2605.27209',
				title: 'Learning to Act under Noise: Enhancing Agent Robustness via Noisy Environments',
				summary: 'Identifies user noise and tool noise as two major sources of interaction noise, proposing training in noisy environments to enhance LLM agent robustness.',
				publishedAt: new Date('2026-05-26T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('uses the full href as externalId for non-blog links', () => {
		const items = parseLongcatResearchBundle(BUNDLE_JS);
		expect(items.find((i) => i.externalId === 'https://huggingface.co/papers/2605.27209')?.url).toBe(
			'https://huggingface.co/papers/2605.27209',
		);
	});

	it('skips cards whose title key is missing from i18n', () => {
		const js = `
			"research.card1.title":{zh:\`A\`,en:\`Title A\`}
			let n=[{href:\`https://longcat.ai/blog/a\`,img:by,alt:\`A\`,date:\`2026-01-01\`,titleKey:\`research.card1.title\`,descKey:\`research.card1.desc\`},{href:\`https://longcat.ai/blog/b\`,img:by,alt:\`B\`,date:\`2026-01-02\`,titleKey:\`research.card2.title\`,descKey:\`research.card2.desc\`}];
		`;
		const items = parseLongcatResearchBundle(js);
		expect(items).toEqual([
			{
				externalId: 'a',
				url: 'https://longcat.ai/blog/a',
				title: 'Title A',
				summary: undefined,
				publishedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('dedupes cards that resolve to the same externalId', () => {
		const js = `
			"research.card1.title":{zh:\`A\`,en:\`Title A\`}
			"research.card2.title":{zh:\`B\`,en:\`Title B\`}
			let n=[{href:\`https://longcat.ai/blog/same\`,img:by,alt:\`A\`,date:\`2026-01-01\`,titleKey:\`research.card1.title\`,descKey:\`research.card1.desc\`},{href:\`https://longcat.ai/blog/same\`,img:by,alt:\`B\`,date:\`2026-01-02\`,titleKey:\`research.card2.title\`,descKey:\`research.card2.desc\`}];
		`;
		const items = parseLongcatResearchBundle(js);
		expect(items).toHaveLength(1);
		expect(items[0]?.title).toBe('Title A');
	});

	it('returns an empty list when the bundle has no research cards', () => {
		expect(parseLongcatResearchBundle('window.owl("start");')).toEqual([]);
	});
});
