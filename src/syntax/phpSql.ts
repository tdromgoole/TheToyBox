import { TokenMatch } from "./types.js";
import { scanSqlTokens, skipBracedBlock } from "./sqlScanner.js";

// PHP tokenizer with embedded SQL support.

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
		if (text[i] === closeChar) return i + 1;
		i++;
	}
	return i;
}

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
	const keywords = new Set([
		"as", "break", "case", "catch", "class", "const", "continue", "declare",
		"default", "do", "echo", "else", "elseif", "extends", "false", "finally",
		"for", "foreach", "function", "if", "implements", "include", "include_once",
		"interface", "match", "namespace", "new", "null", "private", "protected",
		"public", "readonly", "require", "require_once", "return", "static", "switch",
		"throw", "trait", "true", "try", "use", "while", "yield",
	]);
	const push = (type: string, start: number, end: number): void => {
		tokens.push({ type, start, end });
	};

	while (i < text.length) {
		const ch = text[i];

		if (text.startsWith("<?php", i) || text.startsWith("?>", i)) {
			const end = text.startsWith("<?php", i) ? i + 5 : i + 2;
			push("keyword", i, end);
			i = end;
			continue;
		}

		// ── Single-quoted PHP strings ───────────────────────────────────────
		if (ch === "'") {
			const start = i;
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
			push("string", start, i);
			continue;
		}

		// ── Skip PHP line comment (//) ───────────────────────────────────────
		if (ch === "/" && text[i + 1] === "/") {
			const start = i;
			while (i < text.length && text[i] !== "\n") {
				i++;
			}
			push("comment", start, i);
			continue;
		}

		// ── Skip PHP hash comment (#) ────────────────────────────────────────
		if (ch === "#") {
			const start = i;
			while (i < text.length && text[i] !== "\n") {
				i++;
			}
			push("comment", start, i);
			continue;
		}

		// ── Skip PHP block comment (/* */) ───────────────────────────────────
		if (ch === "/" && text[i + 1] === "*") {
			const start = i;
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
			push("comment", start, i);
			continue;
		}

		// ── Double-quoted string — scan SQL tokens inside ────────────────────
		if (ch === '"') {
			const strEnd = findStringEnd(text, i + 1, '"');
			if (SQL_ANCHOR_RE.test(text.slice(i + 1, strEnd - 1))) {
				i = scanSqlTokens(text, i + 1, tokens, '"', phpInterpolation);
			} else {
				push("string", i, strEnd);
				i = strEnd;
			}
			continue;
		}

		const variable = text.slice(i).match(/^\$[A-Za-z_]\w*/);
		if (variable) {
			push("phpVariable", i, i + variable[0].length);
			i += variable[0].length;
			continue;
		}

		const number = text.slice(i).match(/^\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b/i);
		if (number) {
			push("number", i, i + number[0].length);
			i += number[0].length;
			continue;
		}

		const identifier = text.slice(i).match(/^[A-Za-z_]\w*/);
		if (identifier) {
			const word = identifier[0];
			const end = i + word.length;
			if (keywords.has(word.toLowerCase())) {
				push("keyword", i, end);
			} else if (/^[A-Z][A-Z0-9_]+$/.test(word)) {
				push("phpConstant", i, end);
			} else if (/^\s*\(/.test(text.slice(end))) {
				push("phpFunction", i, end);
			}
			i = end;
			continue;
		}

		i++;
	}

	return tokens;
}
