/** Builds a static, network-isolated webview document for HTML-to-PDF serialization. */
export function buildSafeHtmlRendererPage(
	htmlContent: string,
	serializerScript: string,
	nonce: string,
): string {
	let sanitized = htmlContent
		.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "")
		.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
		.replace(/<script\b[^>]*\/\s*>/gi, "")
		.replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(/\s+(href|src|action|formaction)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "")
		.replace(/\s+(href|src|action|formaction)\s*=\s*javascript:[^\s>]*/gi, "");

	const csp = [
		"default-src 'none'",
		"img-src data: blob:",
		"style-src 'unsafe-inline'",
		`script-src 'nonce-${nonce}'`,
		"object-src 'none'",
		"frame-src 'none'",
		"connect-src 'none'",
		"font-src 'none'",
		"base-uri 'none'",
		"form-action 'none'",
	].join("; ");
	const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
	sanitized = /<head\b[^>]*>/i.test(sanitized)
		? sanitized.replace(/<head\b([^>]*)>/i, `<head$1>\n${cspMeta}`)
		: `${cspMeta}\n${sanitized}`;

	const serializer = serializerScript.replace(/^<script>/, `<script nonce="${nonce}">`);
	return /<\/body\s*>/i.test(sanitized)
		? sanitized.replace(/<\/body\s*>/i, `${serializer}\n</body>`)
		: `${sanitized}\n${serializer}`;
}
