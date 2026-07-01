import { createSource } from '../factory';

createSource(
	{
		id: 'bedrock-models',
		name: 'AWS Bedrock Models',
		mode: 'append',
		schedule: '0 */6 * * *',
	},
	{
		kind: 'browser',
		async extract(ctx) {
			if (!ctx.browser) {
				throw new Error('Browser binding is not available');
			}
			// TODO: 用 Browser Rendering 解析 Bedrock 模型列表页
			return [];
		},
	},
);
