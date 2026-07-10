export function escapeHtml(value: unknown): string {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function page(title: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.5}
body{margin:0;background:#f7f7f4;color:#171717}
a{color:#155e75;text-decoration:none}a:hover{text-decoration:underline}
header{border-bottom:1px solid #ddd;background:#fff}
nav,main{max-width:1120px;margin:0 auto;padding:16px}
nav{display:flex;gap:16px;align-items:center}
.brand{font-weight:700;color:#111}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.item,.source,.panel{border:1px solid #ddd;background:#fff;border-radius:8px;padding:14px}
.meta{color:#666;font-size:13px}
.summary{color:#333}
fieldset.panel{margin-top:16px;border:1px solid #ccc;border-radius:8px;padding:12px 14px}
fieldset.panel:first-of-type{margin-top:0}
fieldset.panel legend{font-weight:600;font-size:14px;color:#155e75;padding:0 6px}
.source{display:flex;align-items:center;gap:10px}
.source+.source{margin-top:10px}
.source{padding:10px 12px;border:1px solid #e3e3e3;border-radius:6px;background:#fafafa}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.pill{border:1px solid #bbb;border-radius:999px;padding:4px 10px;background:#fff}
button,input{font:inherit}
input{padding:8px;border:1px solid #bbb;border-radius:6px}
button{padding:8px 12px;border:1px solid #155e75;border-radius:6px;background:#155e75;color:white}
</style>
</head>
<body>
<header><nav><a class="brand" href="/">Beacon</a><a href="/browse/sources">Sources</a><a href="/app/subscriptions">Subscriptions</a></nav></header>
<main>${body}</main>
</body>
</html>`;
}
