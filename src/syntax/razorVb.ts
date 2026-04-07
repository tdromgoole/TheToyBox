import { TokenMatch } from "./types";

// Razor VB (.vbhtml) tokenizer
// Handles HTML with embedded VB via @-transitions and @Code...End Code blocks.
// Token types emitted: comment, string, number, keyword, htmlTag, htmlAttribute,
//                      htmlString, razorDelimiter, razorBlock

// Built-in VB.NET types — shown in teal in Visual Studio (distinct from blue keywords)
const VB_TYPES = new Set([
	"boolean",
	"byte",
	"cbool",
	"cbyte",
	"cchar",
	"cdate",
	"cdbl",
	"cdec",
	"char",
	"cint",
	"clng",
	"cobj",
	"csbyte",
	"cshort",
	"csng",
	"cstr",
	"ctype",
	"cuint",
	"culng",
	"cushort",
	"date",
	"decimal",
	"double",
	"integer",
	"long",
	"object",
	"sbyte",
	"short",
	"single",
	"string",
	"uinteger",
	"ulong",
	"ushort",
]);

// Razor line directives — shown in italic/distinct color in Visual Studio
const RAZOR_DIRECTIVES = new Set([
	"model",
	"using",
	"layout",
	"section",
	"inherits",
	"namespace",
	"inject",
	"page",
	"attribute",
	"implements",
	"addtaghelper",
	"removetaghelper",
	"taghelperprefix",
	"functions",
	"code",
]);

const VB_KEYWORDS = new Set([
	"addhandler",
	"addressof",
	"alias",
	"and",
	"andalso",
	"as",
	"byref",
	"byval",
	"call",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"declare",
	"default",
	"delegate",
	"dim",
	"directcast",
	"do",
	"each",
	"else",
	"elseif",
	"end",
	"endif",
	"enum",
	"erase",
	"error",
	"event",
	"exit",
	"false",
	"finally",
	"for",
	"friend",
	"function",
	"get",
	"gettype",
	"getxmlnamespace",
	"global",
	"gosub",
	"goto",
	"handles",
	"if",
	"implements",
	"imports",
	"in",
	"inherits",
	"interface",
	"is",
	"isnot",
	"let",
	"lib",
	"like",
	"loop",
	"me",
	"mod",
	"module",
	"mustinherit",
	"mustoverride",
	"mybase",
	"myclass",
	"namespace",
	"narrowing",
	"new",
	"next",
	"not",
	"nothing",
	"notinheritable",
	"notoverridable",
	"of",
	"on",
	"operator",
	"option",
	"optional",
	"or",
	"orelse",
	"overloads",
	"overridable",
	"overrides",
	"paramarray",
	"partial",
	"preserve",
	"private",
	"property",
	"protected",
	"public",
	"raiseevent",
	"readonly",
	"redim",
	"rem",
	"removehandler",
	"resume",
	"return",
	"select",
	"set",
	"shadows",
	"shared",
	"static",
	"step",
	"stop",
	"structure",
	"sub",
	"synclock",
	"then",
	"throw",
	"to",
	"true",
	"try",
	"trycast",
	"typeof",
	"using",
	"variant",
	"when",
	"while",
	"widening",
	"with",
	"withevents",
	"writeonly",
	"xor",
]);

export function tokenizeRazorVb(text: string): TokenMatch[] {
	const tokens: TokenMatch[] = [];
	let i = 0;

	while (i < text.length) {
		// ════════════════════════════════════════════
		// Razor transition rules (always checked first)
		// ════════════════════════════════════════════

		// ── Escaped @@ → literal @ (skip entirely) ──
		if (text[i] === "@" && text[i + 1] === "@") {
			i += 2;
			continue;
		}

		// ── @* comment block *@ ──
		if (text[i] === "@" && text[i + 1] === "*") {
			const start = i;
			i += 2;
			while (
				i < text.length &&
				!(text[i] === "*" && text[i + 1] === "@")
			) {
				i++;
			}
			i += 2; // skip *@
			tokens.push({ type: "comment", start, end: i });
			continue;
		}

		// ── @Code ... End Code block ──
		if (
			text[i] === "@" &&
			text.slice(i + 1, i + 5).toLowerCase() === "code" &&
			(i + 5 >= text.length || /[\s\r\n]/.test(text[i + 5]))
		) {
			// Emit @Code delimiter
			tokens.push({ type: "razorDelimiter", start: i, end: i + 5 });
			i += 5;
			// Tokenize VB code until End Code
			i = tokenizeVbBlock(text, i, tokens, "end code");
			// Emit End Code delimiter
			const endCodeStart = i;
			// skip "End Code"
			while (i < text.length && !/\n/.test(text[i])) {
				i++;
			}
			tokens.push({
				type: "razorDelimiter",
				start: endCodeStart,
				end: i,
			});
			continue;
		}

		// ── @Functions ... End Functions block ──
		if (
			text[i] === "@" &&
			text.slice(i + 1, i + 10).toLowerCase() === "functions" &&
			(i + 10 >= text.length || /[\s\r\n{]/.test(text[i + 10]))
		) {
			tokens.push({ type: "razorDelimiter", start: i, end: i + 10 });
			i += 10;
			i = tokenizeVbBlock(text, i, tokens, "end functions");
			const endStart = i;
			while (i < text.length && !/\n/.test(text[i])) {
				i++;
			}
			tokens.push({ type: "razorDelimiter", start: endStart, end: i });
			continue;
		}

		// ── @( expression ) ──
		if (text[i] === "@" && text[i + 1] === "(") {
			tokens.push({ type: "razorDelimiter", start: i, end: i + 2 });
			i += 2;
			let depth = 1;
			while (i < text.length && depth > 0) {
				if (text[i] === "(") {
					depth++;
					i++;
				} else if (text[i] === ")") {
					depth--;
					if (depth === 0) {
						tokens.push({
							type: "razorDelimiter",
							start: i,
							end: i + 1,
						});
						i++;
					} else {
						i++;
					}
				} else {
					i = tokenizeVbToken(text, i, tokens);
				}
			}
			continue;
		}

		// ── @{ code block } ──
		if (text[i] === "@" && text[i + 1] === "{") {
			tokens.push({ type: "razorDelimiter", start: i, end: i + 2 });
			i += 2;
			let depth = 1;
			while (i < text.length && depth > 0) {
				if (text[i] === "{") {
					depth++;
					i++;
				} else if (text[i] === "}") {
					depth--;
					if (depth === 0) {
						tokens.push({
							type: "razorDelimiter",
							start: i,
							end: i + 1,
						});
						i++;
					} else {
						i++;
					}
				} else {
					i = tokenizeVbToken(text, i, tokens);
				}
			}
			continue;
		}

		// ── @identifier — directive or inline expression ──
		if (
			text[i] === "@" &&
			i + 1 < text.length &&
			/[a-zA-Z_]/.test(text[i + 1])
		) {
			const atPos = i;
			i++; // skip @

			// Read the first word after @
			const wordStart = i;
			while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
				i++;
			}
			const firstWord = text.slice(wordStart, i).toLowerCase();

			if (RAZOR_DIRECTIVES.has(firstWord)) {
				// Razor line directive: emit @ and the directive word distinctly
				tokens.push({
					type: "razorDelimiter",
					start: atPos,
					end: wordStart,
				});
				tokens.push({
					type: "razorDirective",
					start: wordStart,
					end: i,
				});
				// Consume the rest of the directive line as VB tokens
				while (
					i < text.length &&
					text[i] !== "\n" &&
					text[i] !== "\r"
				) {
					i = tokenizeVbToken(text, i, tokens);
				}
			} else {
				// Inline expression: emit @ as delimiter
				tokens.push({
					type: "razorDelimiter",
					start: atPos,
					end: wordStart,
				});
				// Classify the first word
				if (VB_TYPES.has(firstWord)) {
					tokens.push({ type: "vbType", start: wordStart, end: i });
				} else if (VB_KEYWORDS.has(firstWord)) {
					tokens.push({ type: "keyword", start: wordStart, end: i });
				}
				// Continue consuming dotted chain (e.g. @Model.Name, @ViewBag.Title)
				while (
					i < text.length &&
					text[i] === "." &&
					/[a-zA-Z_]/.test(text[i + 1])
				) {
					i++; // skip dot
					const segStart = i;
					while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
						i++;
					}
					const seg = text.slice(segStart, i).toLowerCase();
					if (VB_TYPES.has(seg)) {
						tokens.push({
							type: "vbType",
							start: segStart,
							end: i,
						});
					} else if (VB_KEYWORDS.has(seg)) {
						tokens.push({
							type: "keyword",
							start: segStart,
							end: i,
						});
					}
				}
				// Optional (args) call
				if (i < text.length && text[i] === "(") {
					i++;
					let depth = 1;
					while (i < text.length && depth > 0) {
						if (text[i] === "(") {
							depth++;
							i++;
						} else if (text[i] === ")") {
							depth--;
							i++;
						} else {
							i = tokenizeVbToken(text, i, tokens);
						}
					}
				}
			}
			continue;
		}

		// ════════════════════════════════════════════
		// HTML rules (outside Razor blocks)
		// ════════════════════════════════════════════

		// ── HTML comment <!-- ... --> ──
		if (text.startsWith("<!--", i)) {
			const start = i;
			i += 4;
			while (i < text.length && !text.startsWith("-->", i)) {
				i++;
			}
			i += 3;
			tokens.push({ type: "comment", start, end: i });
			continue;
		}

		// ── HTML tag ──
		if (
			text[i] === "<" &&
			i + 1 < text.length &&
			/[a-zA-Z/!]/.test(text[i + 1])
		) {
			const tagStart = i;
			i++; // skip <
			if (text[i] === "/") {
				i++;
			}
			const nameStart = i;
			while (i < text.length && /[a-zA-Z0-9:-]/.test(text[i])) {
				i++;
			}
			if (i > nameStart) {
				tokens.push({ type: "htmlTag", start: tagStart, end: i });
			}

			// Attributes
			while (i < text.length && text[i] !== ">" && text[i] !== "@") {
				if (/\s/.test(text[i])) {
					i++;
					continue;
				}
				if (text[i] === "/" && text[i + 1] === ">") {
					i += 2;
					break;
				}
				if (/[a-zA-Z_:]/.test(text[i])) {
					const attrStart = i;
					while (
						i < text.length &&
						/[a-zA-Z0-9_:\-.@]/.test(text[i])
					) {
						i++;
					}
					tokens.push({
						type: "htmlAttribute",
						start: attrStart,
						end: i,
					});
					while (i < text.length && /[\s=]/.test(text[i])) {
						i++;
					}
					if (
						i < text.length &&
						(text[i] === '"' || text[i] === "'")
					) {
						const quote = text[i];
						const valStart = i;
						i++;
						while (
							i < text.length &&
							text[i] !== quote &&
							text[i] !== "@"
						) {
							i++;
						}
						if (i < text.length && text[i] === quote) {
							i++;
						}
						tokens.push({
							type: "htmlString",
							start: valStart,
							end: i,
						});
					}
					continue;
				}
				i++;
			}
			if (i < text.length && text[i] === ">") {
				i++;
			}
			continue;
		}

		i++;
	}

	return tokens;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tokenize a VB code block until the given end marker (case-insensitive).
 * Returns the index at the start of the end marker.
 */
function tokenizeVbBlock(
	text: string,
	i: number,
	tokens: TokenMatch[],
	endMarker: string,
): number {
	while (i < text.length) {
		// Check for end marker
		if (text.slice(i).toLowerCase().startsWith(endMarker)) {
			return i;
		}
		i = tokenizeVbToken(text, i, tokens);
	}
	return i;
}

/**
 * Consume and emit a single VB token at position i. Returns the new position.
 */
function tokenizeVbToken(
	text: string,
	i: number,
	tokens: TokenMatch[],
): number {
	const ch = text[i];

	// Whitespace / newline
	if (/[\s\r\n]/.test(ch)) {
		return i + 1;
	}

	// VB line comment '
	if (ch === "'") {
		const start = i;
		while (i < text.length && text[i] !== "\n" && text[i] !== "\r") {
			i++;
		}
		tokens.push({ type: "comment", start, end: i });
		return i;
	}

	// Rem comment
	if (
		text.slice(i, i + 3).toLowerCase() === "rem" &&
		(i + 3 >= text.length || /\s/.test(text[i + 3]))
	) {
		const start = i;
		while (i < text.length && text[i] !== "\n" && text[i] !== "\r") {
			i++;
		}
		tokens.push({ type: "comment", start, end: i });
		return i;
	}

	// String literal "..."
	if (ch === '"') {
		const start = i;
		i++;
		while (i < text.length) {
			if (text[i] === '"') {
				i++;
				if (i < text.length && text[i] === '"') {
					i++; // escaped ""
				} else {
					break;
				}
			} else {
				i++;
			}
		}
		tokens.push({ type: "string", start, end: i });
		return i;
	}

	// Number
	if (/[0-9]/.test(ch) || (ch === "&" && /[hHoO]/.test(text[i + 1]))) {
		const start = i;
		if (ch === "&") {
			i += 2;
			while (i < text.length && /[0-9a-fA-F]/.test(text[i])) {
				i++;
			}
		} else {
			while (i < text.length && /[0-9.]/.test(text[i])) {
				i++;
			}
			if (i < text.length && (text[i] === "e" || text[i] === "E")) {
				i++;
				if (i < text.length && (text[i] === "+" || text[i] === "-")) {
					i++;
				}
				while (i < text.length && /[0-9]/.test(text[i])) {
					i++;
				}
			}
			// Type suffixes: I, L, S, D, F, R, UI, UL, US
			if (i < text.length && /[ILSDFRUiilsdfruu]/.test(text[i])) {
				i++;
				if (i < text.length && /[ILil]/.test(text[i])) {
					i++;
				}
			}
		}
		tokens.push({ type: "number", start, end: i });
		return i;
	}

	// Identifier / keyword / type
	if (/[a-zA-Z_]/.test(ch)) {
		const start = i;
		while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
			i++;
		}
		const word = text.slice(start, i).toLowerCase();
		if (VB_TYPES.has(word)) {
			tokens.push({ type: "vbType", start, end: i });
		} else if (VB_KEYWORDS.has(word)) {
			tokens.push({ type: "keyword", start, end: i });
		}
		return i;
	}

	return i + 1;
}
