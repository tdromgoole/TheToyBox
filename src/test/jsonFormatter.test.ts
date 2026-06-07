import * as assert from "assert";
import { formatJson } from "../jsonFormatter.js";

suite("formatJson", () => {
	test("compact JSON → pretty-printed with 4-space indent", () => {
		const input = '{"a":1,"b":2}';
		const result = formatJson(input, 4);
		assert.strictEqual(result, JSON.stringify({ a: 1, b: 2 }, null, 4));
	});

	test("already pretty JSON is re-formatted", () => {
		const input = '{\n  "x": 1\n}';
		const result = formatJson(input, 2);
		assert.strictEqual(result, JSON.stringify({ x: 1 }, null, 2));
	});

	test("2-space indent", () => {
		const input = '{"hello":"world"}';
		const result = formatJson(input, 2);
		assert.ok(result.includes("  "));
		assert.ok(result.includes('"hello"'));
	});

	test("tab character indent", () => {
		const input = '{"key":"value"}';
		const result = formatJson(input, "\t");
		assert.ok(result.includes("\t"));
	});

	test("nested objects are formatted", () => {
		const input = '{"db":{"host":"localhost","port":5432}}';
		const result = formatJson(input, 4);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.db.host, "localhost");
		assert.strictEqual(parsed.db.port, 5432);
	});

	test("arrays are formatted", () => {
		const input = "[1,2,3]";
		const result = formatJson(input, 4);
		assert.deepStrictEqual(JSON.parse(result), [1, 2, 3]);
	});

	test("invalid JSON returns original text unchanged", () => {
		const input = "not valid json {";
		const result = formatJson(input, 4);
		assert.strictEqual(result, input);
	});

	test("empty object formats correctly", () => {
		const result = formatJson("{}", 4);
		assert.strictEqual(result, "{}");
	});

	test("default indent (4 spaces) is used when not specified", () => {
		const input = '{"a":1}';
		const result = formatJson(input);
		assert.strictEqual(result, JSON.stringify({ a: 1 }, null, 4));
	});
});
