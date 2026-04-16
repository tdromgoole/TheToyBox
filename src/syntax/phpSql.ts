import { TokenMatch } from "./types";
import { scanSqlTokens, skipBracedBlock } from "./sqlScanner";

// PHP SQL tokenizer
// Finds double-quoted PHP strings and highlights T-SQL syntax within them.
// Token types emitted: sqlKeyword, sqlType, sqlFunction, sqlVariable, comment, number

// ─── PHP interpolation skipper ────────────────────────────────────────────────
// Handles $var, $var[key], ${expr}, and {$expr} inside double-quoted strings.
// Returns the new position if an interpolation was consumed, or -1 if not.

function phpInterpolation(text: string, i: number): number {
	const ch = text[i];

	// $var or ${expr}
	if (ch === "$" && i + 1 < text.length && /[a-zA-Z_{]/.test(text[i + 1])) {
		if (text[i + 1] === "{") {
			return skipBracedBlock(text, i + 1);
		}
		// $varName — skip identifier and optional [key]
		i += 2;
		while (i < text.length && /\w/.test(text[i])) {
			i++;
		}
		if (i < text.length && text[i] === "[") {
			while (i < text.length && text[i] !== "]") {
				i++;
			}
			if (i < text.length) {
				i++;
			}
		}
		return i;
	}

	// {$expr}
	if (ch === "{" && i + 1 < text.length && text[i + 1] === "$") {
		return skipBracedBlock(text, i);
	}

	return -1;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function tokenizePhpSql(text: string): TokenMatch[] {
	const tokens: TokenMatch[] = [];
	let i = 0;

	while (i < text.length) {
		const ch = text[i];

		// ── Skip single-quoted PHP strings ──────────────────────────────────
		if (ch === "'") {
			i++;
			while (i < text.length) {
				if (text[i] === "\\" && i + 1 < text.length) {
					i += 2;
					continue;
				}
				if (text[i] === "'") {
					i++;
					break;
				}
				i++;
			}
			continue;
		}

		// ── Skip PHP line comment (//) ───────────────────────────────────────
		if (ch === "/" && text[i + 1] === "/") {
			while (i < text.length && text[i] !== "\n") {
				i++;
			}
			continue;
		}

		// ── Skip PHP hash comment (#) ────────────────────────────────────────
		if (ch === "#") {
			while (i < text.length && text[i] !== "\n") {
				i++;
			}
			continue;
		}

		// ── Skip PHP block comment (/* */) ───────────────────────────────────
		if (ch === "/" && text[i + 1] === "*") {
			i += 2;
			while (
				i < text.length &&
				!(text[i] === "*" && text[i + 1] === "/")
			) {
				i++;
			}
			if (i < text.length) {
				i += 2;
			}
			continue;
		}

		// ── Double-quoted string — scan SQL tokens inside ────────────────────
		if (ch === '"') {
			i = scanSqlTokens(text, i + 1, tokens, '"', phpInterpolation);
			continue;
		}

		i++;
	}

	return tokens;
}
