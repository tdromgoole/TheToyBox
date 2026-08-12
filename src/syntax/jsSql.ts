import { TokenMatch } from "./types.js";
import { scanSqlTokens, skipBracedBlock } from "./sqlScanner.js";

// JS / TS SQL tokenizer
// Finds SQL in double-quoted strings, single-quoted strings, and template
// literals, then highlights T-SQL syntax within them.
// Token types emitted: sqlKeyword, sqlType, sqlFunction, sqlVariable, comment, number

// Only scan strings that contain at least one unambiguous SQL statement keyword.
const SQL_ANCHOR_RE =
	/\b(?:select|insert|update|delete|create|alter|drop|merge|truncate)\b/i;

// Find the index just past the closing quote, handling escape sequences.
function findStringEnd(text: string, start: number, closeChar: string): number {
	let i = start;
	while (i < text.length) {
		if (text[i] === "\\" && i + 1 < text.length) {
			i += 2;
			continue;
		}
		if (text[i] === closeChar) {return i + 1;}
		i++;
	}
	return i;
}

// Like findStringEnd but also skips ${...} interpolation blocks.
function findTemplateLiteralEnd(text: string, start: number): number {
	let i = start;
	while (i < text.length) {
		if (text[i] === "\\" && i + 1 < text.length) {
			i += 2;
			continue;
		}
		if (text[i] === "$" && text[i + 1] === "{") {
			i = skipBracedBlock(text, i + 1);
			continue;
		}
		if (text[i] === "`") {return i + 1;}
		i++;
	}
	return i;
}

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
			while (i < text.length && text[i] !== "\n") {
				i++;
			}
			continue;
		}

		// ── Skip block comment (/* */) ───────────────────────────────────────
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

		// ── Double-quoted string ─────────────────────────────────────────────
		if (ch === '"') {
			const strEnd = findStringEnd(text, i + 1, '"');
			if (SQL_ANCHOR_RE.test(text.slice(i + 1, strEnd - 1))) {
				scanSqlTokens(text, i + 1, tokens, '"');
			}
			i = strEnd;
			continue;
		}

		// ── Single-quoted string ─────────────────────────────────────────────────────
		if (ch === "'") {
			const strEnd = findStringEnd(text, i + 1, "'");
			if (SQL_ANCHOR_RE.test(text.slice(i + 1, strEnd - 1))) {
				scanSqlTokens(text, i + 1, tokens, "'");
			}
			i = strEnd;
			continue;
		}

		// ── Template literal ─────────────────────────────────────────────────────────
		if (ch === "`") {
			const strEnd = findTemplateLiteralEnd(text, i + 1);
			if (SQL_ANCHOR_RE.test(text.slice(i + 1, strEnd - 1))) {
				i = scanSqlTokens(
					text,
					i + 1,
					tokens,
					"`",
					jsTemplateInterpolation,
				);
			} else {
				i = strEnd;
			}
			continue;
		}

		i++;
	}

	return tokens;
}
