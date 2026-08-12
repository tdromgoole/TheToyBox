import { bundledLanguages, createHighlighter } from "shiki";
import type { StyledRun } from "./codeTokenizer";

const THEME = "github-light";
const MAX_CODE_BLOCK_CHARS = 200_000;

let highlighterPromise: ReturnType<typeof createHighlighter> | undefined;
let highlighterFactory = createHighlighter;

function getHighlighter() {
	if (!highlighterPromise) {
		const pending = highlighterFactory({ langs: [], themes: [THEME] });
		highlighterPromise = pending;
		void pending.catch(() => {
			if (highlighterPromise === pending) {
				highlighterPromise = undefined;
			}
		});
	}
	return highlighterPromise;
}

/** Test seam for simulating transient Shiki startup failures. */
export function setShikiHighlighterFactoryForTests(
	factory: typeof createHighlighter = createHighlighter,
): void {
	highlighterFactory = factory;
	highlighterPromise = undefined;
}

/**
 * Loads only the bundled grammars needed by this document, then returns a
 * synchronous adapter for the PDF builder. No HTML is produced or executed.
 */
export async function prepareShikiCodeHighlighter(languages: string[]): Promise<
	(text: string, language: string) => StyledRun[][] | undefined
> {
	const highlighter = await getHighlighter();
	const requested = [...new Set(languages.map((lang) => lang.toLowerCase()))]
		.filter((lang) => lang !== "mermaid" && lang !== "text" && lang !== "plain" && lang !== "txt")
		.filter((lang) => Object.prototype.hasOwnProperty.call(bundledLanguages, lang));
	const loaded = new Set(highlighter.getLoadedLanguages());
	for (const language of requested) {
		if (!loaded.has(language)) {
			await highlighter.loadLanguage(language as never);
		}
	}

	return (text: string, language: string): StyledRun[][] | undefined => {
		const lang = language.toLowerCase();
		if (
			text.length > MAX_CODE_BLOCK_CHARS ||
			!highlighter.getLoadedLanguages().includes(lang)
		) {
			return undefined;
		}
		try {
			const result = highlighter.codeToTokens(text, { lang: lang as never, theme: THEME });
			return result.tokens.map((line) =>
				line.map((token) => ({
					text: token.content,
					color: token.color,
					italic: typeof token.fontStyle === "number" && (token.fontStyle & 1) !== 0 || undefined,
					bold: typeof token.fontStyle === "number" && (token.fontStyle & 2) !== 0 || undefined,
				})),
			);
		} catch {
			return undefined;
		}
	};
}
