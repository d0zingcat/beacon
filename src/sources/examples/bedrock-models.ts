import { createBrowserSource } from '../browser';

createBrowserSource(
	{
		id: 'bedrock-models',
		name: 'AWS Bedrock Models',
		mode: 'append',
		schedule: '0 */6 * * *',
	},
	{
		url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html',
	},
	async () => {
		// TODO: 用 Browser Rendering 解析 Bedrock 模型列表页
		return [];
	},
);
