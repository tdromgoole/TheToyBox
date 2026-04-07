import { TokenMatch } from "./types";

// ─── KDL tokenizer ────────────────────────────────────────────────────────────
export function tokenizeKdl(text: string): TokenMatch[] {
	const tokens: TokenMatch[] = [];
	let i = 0;
	let atLineStart = true; // true => next bare identifier is a node name
	let nodeNameDone = false; // only one node name per logical line

	while (i < text.length) {
		const ch = text[i];

		// ── Newline: reset logical line tracking ──
		if (ch === "\n" || ch === "\r") {
			atLineStart = true;
			nodeNameDone = false;
			i++;
			continue;
		}

		// ── Whitespace ──
		if (ch === " " || ch === "\t") {
			i++;
			continue;
		}

		// ── Semicolon: statement separator (next identifier = new node name) ──
		if (ch === ";") {
			nodeNameDone = false;
			i++;
			continue;
		}

		// ── Opening brace: children block (next identifier = new node name) ──
		if (ch === "{") {
			atLineStart = true;
			nodeNameDone = false;
			i++;
			continue;
		}

		// ── Closing brace ──
		if (ch === "}") {
			i++;
			continue;
		}

		// ── Line comment // ──
		if (ch === "/" && text[i + 1] === "/") {
			const start = i;
			i += 2;
			while (i < text.length && text[i] !== "\n" && text[i] !== "\r") {
				i++;
			}
			tokens.push({ type: "comment", start, end: i });
			// Rest of logical line is gone
			atLineStart = true;
			nodeNameDone = false;
			continue;
		}

		// ── Block comment /* ... */ (nested, per KDL spec) ──
		if (ch === "/" && text[i + 1] === "*") {
			const start = i;
			i += 2;
			let depth = 1;
			while (i < text.length && depth > 0) {
				if (text[i] === "/" && text[i + 1] === "*") {
					depth++;
					i += 2;
				} else if (text[i] === "*" && text[i + 1] === "/") {
					depth--;
					i += 2;
				} else {
					i++;
				}
			}
			tokens.push({ type: "comment", start, end: i });
			continue;
		}

		// ── Slashdash /- (comment out next item) ──
		if (ch === "/" && text[i + 1] === "-") {
			tokens.push({ type: "comment", start: i, end: i + 2 });
			i += 2;
			continue;
		}

		// ── String literal "..." ──
		if (ch === '"') {
			const start = i;
			i++; // skip opening quote
			while (i < text.length && text[i] !== '"') {
				if (text[i] === "\\") {
					i++; // skip escape character
				}
				i++;
			}
			if (i < text.length) {
				i++; // skip closing quote
			}
			tokens.push({ type: "string", start, end: i });
			atLineStart = false;
			continue;
		}

		// ── Raw string r"..." or r#"..."# ──
		if (
			ch === "r" &&
			i + 1 < text.length &&
			(text[i + 1] === '"' || text[i + 1] === "#")
		) {
			const start = i;
			i++; // skip 'r'
			let hashes = 0;
			while (i < text.length && text[i] === "#") {
				hashes++;
				i++;
			}
			if (i < text.length && text[i] === '"') {
				i++; // skip opening quote
				const closer = '"' + "#".repeat(hashes);
				while (i < text.length) {
					if (text.startsWith(closer, i)) {
						i += closer.length;
						break;
					}
					i++;
				}
			}
			tokens.push({ type: "string", start, end: i });
			atLineStart = false;
			continue;
		}

		// ── Type annotation (...) ──
		if (ch === "(") {
			const start = i;
			i++;
			while (i < text.length && text[i] !== ")") {
				i++;
			}
			if (i < text.length) {
				i++; // skip closing paren
			}
			tokens.push({ type: "typeAnnotation", start, end: i });
			continue;
		}

		// ── Number: digit or minus sign followed by digit ──
		if (
			/[0-9]/.test(ch) ||
			(ch === "-" && i + 1 < text.length && /[0-9]/.test(text[i + 1]))
		) {
			const start = i;
			if (ch === "-") {
				i++;
			}
			// Hex / octal / binary prefix
			if (
				text[i] === "0" &&
				i + 1 < text.length &&
				"xXoObB".includes(text[i + 1])
			) {
				i += 2;
				while (i < text.length && /[0-9a-fA-F_]/.test(text[i])) {
					i++;
				}
			} else {
				// Decimal integer part
				while (i < text.length && /[0-9_]/.test(text[i])) {
					i++;
				}
				// Optional fractional part
				if (i < text.length && text[i] === ".") {
					i++;
					while (i < text.length && /[0-9_]/.test(text[i])) {
						i++;
					}
				}
				// Optional exponent
				if (i < text.length && (text[i] === "e" || text[i] === "E")) {
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
			atLineStart = false;
			continue;
		}

		// ── Identifier: letters / underscore start, then letters/digits/underscore/hyphen ──
		if (/[a-zA-Z_]/.test(ch)) {
			const start = i;
			while (i < text.length && /[a-zA-Z0-9_\-.]/.test(text[i])) {
				i++;
			}
			const word = text.slice(start, i);

			// Boolean / null keywords
			if (word === "true" || word === "false" || word === "null") {
				tokens.push({ type: "boolean", start, end: i });
				atLineStart = false;
				continue;
			}

			// Property key: identifier immediately followed by '='
			if (i < text.length && text[i] === "=") {
				tokens.push({ type: "propKey", start, end: i });
				atLineStart = false;
				continue;
			}

			// Node name: first bare identifier on a logical line
			if (atLineStart && !nodeNameDone) {
				tokens.push({ type: "nodeName", start, end: i });
				nodeNameDone = true;
				atLineStart = false;
				continue;
			}

			// Other bare identifier value — no token emitted
			atLineStart = false;
			continue;
		}

		// ── Anything else — advance and clear line-start flag ──
		atLineStart = false;
		i++;
	}

	return tokens;
}
