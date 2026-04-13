import { TokenMatch } from "./types";
import { scanSqlTokens, skipBracedBlock } from "./sqlScanner";

// JS / TS SQL tokenizer
// Finds SQL in double-quoted strings, single-quoted strings, and template
// literals, then highlights T-SQL syntax within them.
// Token types emitted: sqlKeyword, sqlType, sqlFunction, sqlVariable, comment, number

// ─── JS template-literal interpolation skipper ───────────────────────────────
// Handles ${expr} inside template literals.
// Returns the new position if consumed, or -1 if not.

function jsTemplateInterpolation(text: string, i: number): number {
	if (text[i] === "$" && text[i + 1] === "{") {
		return skipBracedBlock(text, i + 1);
	}
	return -1;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function tokenizeJsSql(text: string): TokenMatch[] {
	const tokens: TokenMatch[] = [];
	let i = 0;

	while (i < text.length) {
		const ch = text[i];

		// ── Skip line comment (//) ───────────────────────────────────────────
		if (ch === "/" && text[i + 1] === "/") {
			while (i < text.length && text[i] !== "\n") { i++; }
			continue;
		}

		// ── Skip block comment (/* */) ───────────────────────────────────────
		if (ch === "/" && text[i + 1] === "*") {
			i += 2;
			while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) { i++; }
			if (i < text.length) { i += 2; }
			continue;
		}

		// ── Double-quoted string ─────────────────────────────────────────────
		if (ch === '"') {
			i = scanSqlTokens(text, i + 1, tokens, '"');
			continue;
		}

		// ── Single-quoted string ─────────────────────────────────────────────
		if (ch === "'") {
			i = scanSqlTokens(text, i + 1, tokens, "'");
			continue;
		}

		// ── Template literal ─────────────────────────────────────────────────
		if (ch === "`") {
			i = scanSqlTokens(text, i + 1, tokens, "`", jsTemplateInterpolation);
			continue;
		}

		i++;
	}

	return tokens;
}
