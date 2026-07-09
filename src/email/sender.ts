export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

export interface EmailSender {
	send(env: Env, message: EmailMessage): Promise<void>;
}

export const emailSender: EmailSender = {
	async send(env, message) {
		if (env.APP_ENV === 'local' && !env.EMAIL) {
			console.log(`Magic link email to ${message.to}: ${message.text}`);
			return;
		}
		if (!env.EMAIL) {
			throw new Error('EMAIL binding is not configured');
		}
		await env.EMAIL.send({
			to: message.to,
			from: { email: 'beacon@d0zingcat.dev', name: 'Beacon' },
			subject: message.subject,
			text: message.text,
			html: message.html,
		});
	},
};
