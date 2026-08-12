import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdownToHtml } from "../markdownRenderer.js";
import {
	buildMarkdownPdfPages,
	describeMarkdownPdfBlocks,
} from "../markdownToPdf.js";
import { prepareShikiCodeHighlighter } from "../shikiHighlighter.js";

suite("Markdown PDF regression fixtures", () => {
	const markdown = fs.readFileSync(
		path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "test", "fixtures", "markdown", "combined.md"),
		"utf8",
	);

	test("preserves representative block ordering and alert containment", () => {
		const html = renderMarkdownToHtml(markdown);
		const blocks = describeMarkdownPdfBlocks(html);
		assert.deepStrictEqual(blocks.map((entry) => entry.split(":")[1]), [
			"h", "p", "alert", "alert", "h", "task", "h", "table",
			"pre", "pre", "pre", "pre", "pre", "pre", "hr", "h", "p",
		]);
		assert.match(blocks[2], /body=Standard alert body stays inside its container\./);
		assert.match(blocks[3], /title=.*Custom warning.*body=Toy Box shorthand body stays inside its container\./);
	});

	test("emits heading rules, printable task marks, tables, and multiple pages", () => {
		const html = renderMarkdownToHtml(markdown.repeat(12));
		const pages = buildMarkdownPdfPages(html, "combined.md", "2026-08-10");
		const content = pages.join("\n");
		assert.ok(pages.length > 1, "large fixture should cross a page boundary");
		assert.match(content, /\/F1 22 Tf/);
		assert.match(content, / re S/);
		assert.match(content, /0\.910 0\.918 0\.926 rg/);
		assert.match(content, / m .* l S/);
	});

	test("collects serialized JPEG images into the PDF page model", () => {
		const images: any[] = [];
		const html = '<p>Before</p><img src="data:image/jpeg;base64,AQID" width="320" height="160"><p>After</p>';
		const blocks = describeMarkdownPdfBlocks(html);
		assert.deepStrictEqual(blocks.map((entry) => entry.split(":")[1]), ["p", "img", "p"]);
		buildMarkdownPdfPages(html, "image.md", "2026-08-10", "Markdown", images);
		assert.strictEqual(images.length, 1);
		assert.deepStrictEqual({ width: images[0].width, height: images[0].height }, { width: 320, height: 160 });
	});

	test("uses Shiki for common languages and falls back for unknown languages", async () => {
		const highlight = await prepareShikiCodeHighlighter(["php", "bash", "json", "sql", "unknown-language"]);
		for (const [language, code] of [["php", "<?php echo 1;"], ["bash", "echo hi"], ["json", '{"a":1}'], ["sql", "SELECT 1"]]) {
			const lines = highlight(code, language);
			assert.ok(lines?.flat().some((run) => Boolean(run.color)), `${language} should be highlighted`);
		}
		assert.strictEqual(highlight("plain fallback", "unknown-language"), undefined);
	});

	test("retains Mermaid as a renderable fenced block before webview conversion", () => {
		const html = renderMarkdownToHtml(markdown);
		assert.match(html, /<pre><code class="language-mermaid">/);
		assert.ok(describeMarkdownPdfBlocks(html).some((entry) => entry.endsWith(":pre")));
	});
});
