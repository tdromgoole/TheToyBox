import * as assert from "node:assert";
import { buildSafeHtmlRendererPage } from "../htmlPrintSanitizer.js";

suite("HTML print sanitizer", () => {
	const serializer = "<script>window.__toyboxSerializerRan = true;</script>";

	test("removes source scripts and permits only the nonce-tagged serializer", () => {
		const page = buildSafeHtmlRendererPage(
			'<html><head><script src="https://example.com/x.js"></script></head><body><script>alert(1)</script><p>Safe</p></body></html>',
			serializer, "test-nonce",
		);
		assert.doesNotMatch(page, /example\.com|alert\(1\)/);
		assert.strictEqual((page.match(/<script\b/g) ?? []).length, 1);
		assert.match(page, /<script nonce="test-nonce">window\.__toyboxSerializerRan/);
	});

	test("removes event handlers and javascript URLs", () => {
		const page = buildSafeHtmlRendererPage(
			`<body onload="steal()"><img src=x onerror='steal()'><a href="javascript:steal()">link</a></body>`,
			serializer, "test-nonce",
		);
		assert.doesNotMatch(page, /onload|onerror|javascript:/i);
		assert.match(page, /<img src=x>/);
	});

	test("replaces source CSP with a network-denying extension CSP", () => {
		const page = buildSafeHtmlRendererPage(
			'<html><head><meta http-equiv="Content-Security-Policy" content="default-src *"></head><body></body></html>',
			serializer, "test-nonce",
		);
		assert.doesNotMatch(page, /default-src \*/);
		assert.match(page, /default-src 'none'/);
		assert.match(page, /connect-src 'none'/);
		assert.match(page, /script-src 'nonce-test-nonce'/);
	});
});
