import * as assert from "assert";
import {
	bookmarkMessage,
	outlineMessage,
	printMessage,
	serializerMessage,
	todoMessage,
	wordFrequencyMessage,
} from "../webviewMessages.js";

suite("Webview message validation", () => {
	test("accepts each provider's supported messages", () => {
		assert.deepStrictEqual(wordFrequencyMessage({ command: "goTo", line: 1 }), { command: "goTo", line: 1 });
		assert.deepStrictEqual(outlineMessage({ command: "jumpTo", line: 0 }), { command: "jumpTo", line: 0 });
		assert.deepStrictEqual(bookmarkMessage({ command: "goTo", uri: "file:///note.md", line: 2 }), { command: "goTo", uri: "file:///note.md", line: 2 });
		assert.deepStrictEqual(bookmarkMessage({ command: "clearAll" }), { command: "clearAll" });
		assert.deepStrictEqual(todoMessage({ command: "refresh" }), { command: "refresh" });
		assert.deepStrictEqual(todoMessage({ command: "goTo", uri: "file:///todo.ts", line: 3 }), { command: "goTo", uri: "file:///todo.ts", line: 3 });
		assert.strictEqual(printMessage({ command: "print" }), true);
		assert.deepStrictEqual(serializerMessage({ type: "serialized", html: "<p>ok</p>" }), { type: "serialized", html: "<p>ok</p>" });
		assert.deepStrictEqual(serializerMessage({ type: "error", message: "failed" }), { type: "error", message: "failed" });
	});

	test("rejects unknown, missing, and incorrectly typed commands", () => {
		const malformed = [null, [], "goTo", {}, { command: "unknown" }];
		for (const value of malformed) {
			assert.strictEqual(wordFrequencyMessage(value), undefined);
			assert.strictEqual(outlineMessage(value), undefined);
			assert.strictEqual(bookmarkMessage(value), undefined);
			assert.strictEqual(todoMessage(value), undefined);
			assert.strictEqual(printMessage(value), false);
			assert.strictEqual(serializerMessage(value), undefined);
		}
	});

	test("rejects unsafe navigation and invalid line values", () => {
		for (const uri of ["https://example.com", "javascript:alert(1)", "", 42]) {
			assert.strictEqual(bookmarkMessage({ command: "goTo", uri, line: 0 }), undefined);
			assert.strictEqual(todoMessage({ command: "goTo", uri, line: 0 }), undefined);
		}
		for (const invalidLine of [-1, 1.5, Number.NaN, "1"]) {
			assert.strictEqual(outlineMessage({ command: "jumpTo", line: invalidLine }), undefined);
			assert.strictEqual(bookmarkMessage({ command: "remove", uri: "file:///a", line: invalidLine }), undefined);
		}
		assert.strictEqual(wordFrequencyMessage({ command: "goTo", line: 0 }), undefined);
	});
});
