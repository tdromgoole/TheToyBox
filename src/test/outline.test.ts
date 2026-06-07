import * as assert from "assert";
import { makeDoc } from "./testHelpers.js";
import { parseIni } from "../outline/parseIni.js";
import { parseYaml } from "../outline/parseYaml.js";
import { parseMarkdown } from "../outline/parseMarkdown.js";
import { parseJson } from "../outline/parseJson.js";
import { parseCss } from "../outline/parseCss.js";
import { parseKdl } from "../outline/parseKdl.js";
import { parseNginx } from "../outline/parseNginx.js";

// ─── parseIni ─────────────────────────────────────────────────────────────────

suite("parseIni", () => {
	test("empty document → no items", () => {
		const doc = makeDoc([""]);
		assert.deepStrictEqual(parseIni(doc), []);
	});

	test("section header → one root item", () => {
		const doc = makeDoc(["[Database]"]);
		const items = parseIni(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, "Database");
		assert.strictEqual(items[0].iniType, "section");
	});

	test("key=value inside section → child item", () => {
		const doc = makeDoc(["[Database]", "host = localhost"]);
		const items = parseIni(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].children.length, 1);
		assert.strictEqual(items[0].children[0].label, "host = localhost");
		assert.strictEqual(items[0].children[0].iniType, "key");
	});

	test("key=value before any section → root item", () => {
		const doc = makeDoc(["version = 1.0"]);
		const items = parseIni(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, "version = 1.0");
	});

	test("comments and blank lines are skipped", () => {
		const doc = makeDoc(["", "; comment", "# also comment", "[Section]"]);
		const items = parseIni(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, "Section");
	});

	test("multiple sections", () => {
		const doc = makeDoc(["[Alpha]", "x = 1", "[Beta]", "y = 2"]);
		const items = parseIni(doc);
		assert.strictEqual(items.length, 2);
		assert.strictEqual(items[0].label, "Alpha");
		assert.strictEqual(items[1].label, "Beta");
	});

	test("line number is correct", () => {
		const doc = makeDoc(["", "[Section]"]);
		const items = parseIni(doc);
		assert.strictEqual(items[0].line, 1);
	});
});

// ─── parseYaml ────────────────────────────────────────────────────────────────

suite("parseYaml", () => {
	test("empty document → no items", () => {
		const doc = makeDoc([""]);
		assert.deepStrictEqual(parseYaml(doc), []);
	});

	test("single scalar key → one root item", () => {
		const doc = makeDoc(["name: Alice"]);
		const items = parseYaml(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, "name: Alice");
	});

	test("mapping key with no inline value → parent item", () => {
		const doc = makeDoc(["database:", "  host: localhost"]);
		const items = parseYaml(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, "database");
		assert.strictEqual(items[0].children.length, 1);
		assert.strictEqual(items[0].children[0].label, "host: localhost");
	});

	test("comments, blank lines, and separators are skipped", () => {
		const doc = makeDoc(["---", "# comment", "", "key: value"]);
		const items = parseYaml(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, "key: value");
	});

	test("sibling keys at root level", () => {
		const doc = makeDoc(["a: 1", "b: 2", "c: 3"]);
		const items = parseYaml(doc);
		assert.strictEqual(items.length, 3);
	});

	test("line number is correct", () => {
		const doc = makeDoc(["---", "key: value"]);
		const items = parseYaml(doc);
		assert.strictEqual(items[0].line, 1);
	});

	test("quoted key is unquoted in label", () => {
		const doc = makeDoc([`"quoted-key": value`]);
		const items = parseYaml(doc);
		assert.ok(items[0].label.startsWith("quoted-key"));
	});
});

// ─── parseMarkdown ────────────────────────────────────────────────────────────

suite("parseMarkdown", () => {
	test("empty document → no items", () => {
		const doc = makeDoc([""]);
		assert.deepStrictEqual(parseMarkdown(doc), []);
	});

	test("h1 → one root item with headingLevel 1", () => {
		const doc = makeDoc(["# Hello"]);
		const items = parseMarkdown(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, "Hello");
		assert.strictEqual(items[0].headingLevel, 1);
	});

	test("h2 under h1 becomes a child", () => {
		const doc = makeDoc(["# Parent", "## Child"]);
		const items = parseMarkdown(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].children.length, 1);
		assert.strictEqual(items[0].children[0].label, "Child");
	});

	test("two h1s are siblings at root", () => {
		const doc = makeDoc(["# First", "# Second"]);
		const items = parseMarkdown(doc);
		assert.strictEqual(items.length, 2);
	});

	test("h3 under h2 under h1 → three levels", () => {
		const doc = makeDoc(["# A", "## B", "### C"]);
		const items = parseMarkdown(doc);
		assert.strictEqual(items[0].children[0].children[0].label, "C");
		assert.strictEqual(items[0].children[0].children[0].headingLevel, 3);
	});

	test("non-heading lines are ignored", () => {
		const doc = makeDoc(["# Title", "Some paragraph text.", "- list item"]);
		const items = parseMarkdown(doc);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].children.length, 0);
	});

	test("line number is correct", () => {
		const doc = makeDoc(["", "# Heading"]);
		const items = parseMarkdown(doc);
		assert.strictEqual(items[0].line, 1);
	});

	test("h1 item has isBold = true", () => {
		const doc = makeDoc(["# Bold heading"]);
		assert.strictEqual(parseMarkdown(doc)[0].isBold, true);
	});
});

// ─── parseJson ────────────────────────────────────────────────────────────────

suite("parseJson", () => {
	test("empty object → no items", () => {
		const doc = makeDoc(["{}"], "json");
		assert.deepStrictEqual(parseJson(doc), []);
	});

	test("empty array → no items", () => {
		const doc = makeDoc(["[]"], "json");
		assert.deepStrictEqual(parseJson(doc), []);
	});

	test("single key at root → one item", () => {
		const doc = makeDoc(['{"name": "Alice"}'], "json");
		const items = parseJson(doc);
		assert.strictEqual(items.length, 1);
		assert.ok(items[0].label.startsWith("name"));
	});

	test("nested object → parent with child", () => {
		const lines = ["{", '  "db": {', '    "host": "localhost"', "  }", "}"];
		const doc = makeDoc(lines, "json");
		const items = parseJson(doc);
		assert.strictEqual(items.length, 1);
		assert.ok(items[0].label.startsWith("db"));
		assert.strictEqual(items[0].children.length, 1);
		assert.ok(items[0].children[0].label.startsWith("host"));
	});

	test("multiple root keys", () => {
		const doc = makeDoc(['{"a": 1, "b": 2, "c": 3}'], "json");
		const items = parseJson(doc);
		assert.strictEqual(items.length, 3);
	});

	test("scalar values include the value in label", () => {
		const doc = makeDoc(['{"port": 5432}'], "json");
		const items = parseJson(doc);
		assert.ok(items[0].label.includes("5432"));
	});

	test("JSONC line comment is skipped", () => {
		const lines = ["{", "  // a comment", '  "key": "value"', "}"];
		const doc = makeDoc(lines, "jsonc");
		const items = parseJson(doc);
		assert.strictEqual(items.length, 1);
		assert.ok(items[0].label.startsWith("key"));
	});
});

// ─── parseCss ─────────────────────────────────────────────────────────────────

suite("parseCss", () => {
	test("empty document → no items", () => {
		const doc = makeDoc([""]);
		assert.deepStrictEqual(parseCss(doc), []);
	});

	test("simple selector → one item", () => {
		const doc = makeDoc(["body {", "  color: red;", "}"]);
		const items = parseCss(doc);
		assert.ok(items.length >= 1);
		assert.ok(items[0].label.includes("body"));
	});

	test("@media rule → one item with keyword label", () => {
		const doc = makeDoc([
			"@media (max-width: 768px) {",
			"  body { color: red; }",
			"}",
		]);
		const items = parseCss(doc);
		assert.ok(items.length >= 1);
		assert.ok(items[0].label.includes("@media"));
	});

	test("custom property → item with -- prefix", () => {
		const doc = makeDoc([":root {", "  --primary: #fff;", "}"]);
		const items = parseCss(doc);
		// custom property may be at root or nested
		const flat = flattenItems(items);
		assert.ok(flat.some((item: any) => item.label.includes("--primary")));
	});

	test("region markers create region items", () => {
		const doc = makeDoc([
			"/* #region Layout */",
			"body { }",
			"/* #endregion */",
		]);
		const items = parseCss(doc);
		assert.ok(items.some((item: any) => item.isRegion));
	});

	test("line comments are skipped", () => {
		const doc = makeDoc(["// just a comment"]);
		const items = parseCss(doc);
		assert.deepStrictEqual(items, []);
	});
});

// ─── parseKdl ─────────────────────────────────────────────────────────────────

suite("parseKdl (outline)", () => {
	test("empty document → no items", () => {
		const doc = makeDoc([""]);
		assert.deepStrictEqual(parseKdl(doc), []);
	});

	test("single node → one root item", () => {
		const doc = makeDoc(['title "My App"']);
		const items = parseKdl(doc);
		assert.strictEqual(items.length, 1);
		assert.ok(items[0].label.includes("title"));
	});

	test("node with children → parent with child items", () => {
		const doc = makeDoc([
			"config {",
			'  host "localhost"',
			"  port 5432",
			"}",
		]);
		const items = parseKdl(doc);
		assert.strictEqual(items.length, 1);
		assert.ok(items[0].label.includes("config"));
		assert.ok(items[0].children.length >= 2);
	});

	test("line comment lines are skipped", () => {
		const doc = makeDoc(["// comment", "node 1"]);
		const items = parseKdl(doc);
		assert.strictEqual(items.length, 1);
	});

	test("closing brace pops the stack", () => {
		const doc = makeDoc(["outer {", "  inner 1", "}", "sibling 2"]);
		const items = parseKdl(doc);
		assert.strictEqual(items.length, 2);
	});
});

// ─── parseNginx ───────────────────────────────────────────────────────────────

suite("parseNginx (outline)", () => {
	test("empty document → no items", () => {
		const doc = makeDoc([""]);
		assert.deepStrictEqual(parseNginx(doc), []);
	});

	test("block directive → one item with children block", () => {
		const doc = makeDoc(["server {", "  listen 80;", "}"]);
		const items = parseNginx(doc);
		assert.ok(items.length >= 1);
		assert.ok(items[0].label.includes("server"));
	});

	test("notable directive → item shown in outline", () => {
		const doc = makeDoc([
			"server {",
			"  listen 443;",
			"  server_name example.com;",
			"}",
		]);
		const items = parseNginx(doc);
		const flat = flattenItems(items);
		assert.ok(flat.some((i: any) => i.label.includes("listen")));
		assert.ok(flat.some((i: any) => i.label.includes("server_name")));
	});

	test("# comments are skipped", () => {
		const doc = makeDoc(["# just a comment"]);
		const items = parseNginx(doc);
		assert.deepStrictEqual(items, []);
	});

	test("region markers create region items", () => {
		const doc = makeDoc(["# region SSL", "server { }", "# endregion"]);
		const items = parseNginx(doc);
		assert.ok(items.some((i: any) => i.isRegion));
	});
});

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Flatten a nested item tree into a flat array. */
function flattenItems(items: any[]): any[] {
	const result: any[] = [];
	function walk(nodes: any[]) {
		for (const n of nodes) {
			result.push(n);
			if (n.children?.length) {
				walk(n.children);
			}
		}
	}
	walk(items);
	return result;
}
