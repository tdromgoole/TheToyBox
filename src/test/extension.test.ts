import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// @ts-expect-error markdown-it does not ship TypeScript declarations.
import MarkdownIt from 'markdown-it';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('exports the Markdown-it preview hook', async () => {
		const extension = vscode.extensions.getExtension('ThomasDromgoole.theToyBox');
		assert.ok(extension, 'The Toy Box extension was not found');
		const api = await extension.activate();
		assert.strictEqual(typeof api?.extendMarkdownIt, 'function');
	});

	test('renders a GitHub-style alert in the built-in preview pipeline', async () => {
		const extension = vscode.extensions.getExtension('ThomasDromgoole.theToyBox');
		assert.ok(extension, 'The Toy Box extension was not found');
		const api = await extension.activate();
		const md = api.extendMarkdownIt(new MarkdownIt());
		const html = md.render('> [!NOTE][Test Heading]\n> This is a test');

		assert.match(html, /<div class="markdown-alert note">/);
		assert.match(html, /<span class="alert-icon">info<\/span> Test Heading/);
		assert.doesNotMatch(html, /\[!NOTE\]/);
	});

	test('renders backward-compatible bare alert markers', async () => {
		const extension = vscode.extensions.getExtension('ThomasDromgoole.theToyBox');
		assert.ok(extension, 'The Toy Box extension was not found');
		const api = await extension.activate();
		const md = api.extendMarkdownIt(new MarkdownIt());
		const html = md.render('[!NOTE] The client provides:\n\n[!NOTE][The client provides:]');

		assert.strictEqual((html.match(/class="markdown-alert note"/g) ?? []).length, 2);
		assert.match(html, /<p>The client provides:<\/p>/);
		assert.match(html, /<span class="alert-icon">info<\/span> The client provides:/);
		assert.doesNotMatch(html, /\[!NOTE\]/);
	});

	test('keeps a legacy unquoted alert body inside the alert', async () => {
		const extension = vscode.extensions.getExtension('ThomasDromgoole.theToyBox');
		assert.ok(extension, 'The Toy Box extension was not found');
		const api = await extension.activate();
		const html = api.renderMarkdownToHtml('> [!NOTE]\nThe client provides:\n\nNext paragraph');

		assert.match(
			html,
			/<div class="markdown-alert note">[\s\S]*?<p>The client provides:<\/p>[\s\S]*?<\/div>/,
		);
		assert.match(html, /<\/div>\s*<p>Next paragraph<\/p>/);
	});

	test('uses Shiki tokens for fenced-code languages', async () => {
		const extension = vscode.extensions.getExtension('ThomasDromgoole.theToyBox');
		assert.ok(extension, 'The Toy Box extension was not found');
		const api = await extension.activate();
		const lines = await api.highlightCodeForPdf('$token = getenv("TOKEN");', 'php');

		assert.ok(lines?.length);
		assert.ok(lines.flat().some((run: { color?: string }) => Boolean(run.color)));
	});

	test('keeps a paragraph and heading separate after a list', async () => {
		const extension = vscode.extensions.getExtension('ThomasDromgoole.theToyBox');
		assert.ok(extension, 'The Toy Box extension was not found');
		const api = await extension.activate();
		const html = api.renderMarkdownToHtml(
			'- First item\n\nSupplied during onboarding.\n\n## 14. Client Readiness Checklist\n\n- [ ] Ready',
		);

		assert.match(html, /<\/ul>\s*<p>Supplied during onboarding\.<\/p>\s*<h2>14\. Client Readiness Checklist<\/h2>/);
		assert.match(html, /<ul class="task-list">/);
	});

});
