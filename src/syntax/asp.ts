import { TokenMatch } from "./types";

// ASP Classic (VBScript) tokenizer
// Handles both pure ASP files and the server-side portions of HTML+ASP.
// Token types emitted: comment, string, number, keyword, htmlTag, htmlAttribute, htmlString

const VBS_KEYWORDS = new Set([
	"and",
	"as",
	"boolean",
	"byref",
	"byte",
	"byval",
	"call",
	"case",
	"class",
	"const",
	"currency",
	"date",
	"dim",
	"do",
	"double",
	"each",
	"else",
	"elseif",
	"empty",
	"end",
	"enum",
	"eqv",
	"error",
	"event",
	"exit",
	"explicit",
	"false",
	"for",
	"function",
	"get",
	"goto",
	"if",
	"imp",
	"implements",
	"in",
	"integer",
	"is",
	"let",
	"like",
	"long",
	"loop",
	"lset",
	"me",
	"mod",
	"new",
	"next",
	"not",
	"nothing",
	"null",
	"object",
	"on",
	"option",
	"or",
	"preserve",
	"private",
	"property",
	"public",
	"raiseevent",
	"redim",
	"rem",
	"resume",
	"rset",
	"select",
	"set",
	"shared",
	"single",
	"static",
	"step",
	"stop",
	"string",
	"sub",
	"then",
	"to",
	"true",
	"type",
	"typeof",
	"until",
	"variant",
	"wend",
	"while",
	"with",
	"xor",
	"response",
	"request",
	"server",
	"session",
	"application",
	"err",
	"true",
	"false",
	"nothing",
	"empty",
	"null",
]);

export function tokenizeAsp(text: string): TokenMatch[] {
	const tokens: TokenMatch[] = [];
	let i = 0;
	let inAspBlock = false; // inside <% ... %> or <%...%>

	while (i < text.length) {
		// ── Enter ASP block <% ──
		if (!inAspBlock && text[i] === "<" && text[i + 1] === "%") {
			const delimStart = i;
			i += 2;
			if (i < text.length && text[i] === "=") {
				i++; // include the = in the delimiter token
			}
			tokens.push({ type: "aspDelimiter", start: delimStart, end: i });
			inAspBlock = true;
			continue;
		}

		// ── Exit ASP block %> ──
		if (inAspBlock && text[i] === "%" && text[i + 1] === ">") {
			tokens.push({ type: "aspDelimiter", start: i, end: i + 2 });
			i += 2;
			inAspBlock = false;
			continue;
		}

		// ════════════════════════════════════════════
		// ASP / VBScript token rules
		// ════════════════════════════════════════════
		if (inAspBlock) {
			const ch = text[i];

			// ── Newline / whitespace ──
			if (ch === "\n" || ch === "\r" || ch === " " || ch === "\t") {
				i++;
				continue;
			}

			// ── VBScript line comment ' ──
			if (ch === "'") {
				const start = i;
				while (
					i < text.length &&
					text[i] !== "\n" &&
					text[i] !== "\r"
				) {
					i++;
				}
				tokens.push({ type: "comment", start, end: i });
				continue;
			}

			// ── REM comment (word boundary) ──
			if (
				(ch === "R" || ch === "r") &&
				text.slice(i, i + 3).toLowerCase() === "rem" &&
				(i + 3 >= text.length || /\s/.test(text[i + 3]))
			) {
				const start = i;
				while (
					i < text.length &&
					text[i] !== "\n" &&
					text[i] !== "\r"
				) {
					i++;
				}
				tokens.push({ type: "comment", start, end: i });
				continue;
			}

			// ── String literal "..." (VBScript uses "" to escape a quote) ──
			if (ch === '"') {
				const start = i;
				i++;
				while (i < text.length) {
					if (text[i] === '"') {
						i++;
						if (i < text.length && text[i] === '"') {
							i++; // escaped quote ""
						} else {
							break;
						}
					} else {
						i++;
					}
				}
				tokens.push({ type: "string", start, end: i });
				continue;
			}

			// ── Number ──
			if (/[0-9]/.test(ch) || (ch === "&" && /[hH]/.test(text[i + 1]))) {
				const start = i;
				if (ch === "&") {
					// Hex literal &H...
					i += 2;
					while (i < text.length && /[0-9a-fA-F]/.test(text[i])) {
						i++;
					}
				} else {
					while (i < text.length && /[0-9.]/.test(text[i])) {
						i++;
					}
					// Optional exponent
					if (
						i < text.length &&
						(text[i] === "e" || text[i] === "E")
					) {
						i++;
						if (
							i < text.length &&
							(text[i] === "+" || text[i] === "-")
						) {
							i++;
						}
						while (i < text.length && /[0-9]/.test(text[i])) {
							i++;
						}
					}
				}
				tokens.push({ type: "number", start, end: i });
				continue;
			}

			// ── Identifier / keyword / boolean ──
			if (/[a-zA-Z_]/.test(ch)) {
				const start = i;
				while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
					i++;
				}
				const word = text.slice(start, i).toLowerCase();

				if (VBS_KEYWORDS.has(word)) {
					tokens.push({ type: "keyword", start, end: i });
				}
				// Other identifiers (variable names, function calls) — no token
				continue;
			}

			// ── Anything else — skip ──
			i++;
			continue;
		}

		// ════════════════════════════════════════════
		// HTML token rules (outside ASP blocks)
		// ════════════════════════════════════════════

		// ── HTML comment <!-- ... --> ──
		if (text.startsWith("<!--", i)) {
			const start = i;
			i += 4;
			while (i < text.length && !text.startsWith("-->", i)) {
				i++;
			}
			i += 3; // skip -->
			tokens.push({ type: "comment", start, end: i });
			continue;
		}

		// ── HTML tag < ... > ──
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

			// Tag name
			const nameStart = i;
			while (i < text.length && /[a-zA-Z0-9:-]/.test(text[i])) {
				i++;
			}
			if (i > nameStart) {
				tokens.push({ type: "htmlTag", start: tagStart, end: i });
			}

			// Attributes until >
			while (
				i < text.length &&
				text[i] !== ">" &&
				!(text[i] === "<" && text[i + 1] === "%")
			) {
				// Skip whitespace
				if (/\s/.test(text[i])) {
					i++;
					continue;
				}

				// Attribute name
				if (/[a-zA-Z_:]/.test(text[i])) {
					const attrStart = i;
					while (
						i < text.length &&
						/[a-zA-Z0-9_:\-.]/.test(text[i])
					) {
						i++;
					}
					tokens.push({
						type: "htmlAttribute",
						start: attrStart,
						end: i,
					});

					// Skip whitespace and =
					while (i < text.length && /[\s=]/.test(text[i])) {
						i++;
					}

					// Attribute value
					if (
						i < text.length &&
						(text[i] === '"' || text[i] === "'")
					) {
						const quote = text[i];
						const valStart = i;
						i++;
						while (i < text.length && text[i] !== quote) {
							i++;
						}
						if (i < text.length) {
							i++; // closing quote
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
