import * as assert from "assert";
import { stringRecord } from "../persistedState.js";

suite("Persisted state validation", () => {
	test("preserves valid Quick Notes string maps", () => {
		assert.deepStrictEqual(
			stringRecord({ "toybox-note-1": "markdown", "untitled:1": "draft" }),
			{ "toybox-note-1": "markdown", "untitled:1": "draft" },
		);
	});

	test("recovers from malformed Quick Notes state", () => {
		for (const malformed of [null, "markdown", 17, [], true]) {
			assert.deepStrictEqual(stringRecord(malformed), {});
		}
	});

	test("drops malformed entries without discarding valid persisted entries", () => {
		assert.deepStrictEqual(
			stringRecord({ valid: "json", missing: null, numeric: 42 }),
			{ valid: "json" },
		);
	});
});
