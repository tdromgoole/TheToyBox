import * as assert from "node:assert";
import {
	prepareShikiCodeHighlighter,
	setShikiHighlighterFactoryForTests,
} from "../shikiHighlighter.js";

suite("Shiki initialization recovery", () => {
	teardown(() => setShikiHighlighterFactoryForTests());

	test("retries after initialization rejects once", async () => {
		let attempts = 0;
		const fakeHighlighter = {
			loaded: [] as string[],
			getLoadedLanguages() { return this.loaded; },
			async loadLanguage(language: string) { this.loaded.push(language); },
			codeToTokens(text: string) {
				return { tokens: [[{ content: text, color: "#123456", fontStyle: 0 }]] };
			},
		};
		setShikiHighlighterFactoryForTests((async () => {
			attempts++;
			if (attempts === 1) {
				throw new Error("transient initialization failure");
			}
			return fakeHighlighter;
		}) as any);

		await assert.rejects(
			prepareShikiCodeHighlighter(["php"]),
			/transient initialization failure/,
		);
		const highlight = await prepareShikiCodeHighlighter(["php"]);
		assert.strictEqual(attempts, 2);
		assert.deepStrictEqual(highlight("echo 1;", "php"), [[{
			text: "echo 1;",
			color: "#123456",
			italic: undefined,
			bold: undefined,
		}]]);
	});
});
