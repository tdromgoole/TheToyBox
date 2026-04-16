import * as vscode from "vscode";

// ── Adaptive depth thresholds ────────────────────────────────────────────────
// For large files we limit how deep the outline tree goes so the webview stays
// responsive.  The thresholds below are intentionally generous — most real-world
// config/data files are well under the "large" mark.
const SMALL_FILE_LINES = 1_000; // full detail
const MEDIUM_FILE_LINES = 10_000; // reduced detail
// Above MEDIUM → minimal detail

function maxDepthForSize(lineCount: number): number {
	if (lineCount <= SMALL_FILE_LINES) {
		return Infinity; // no limit
	}
	if (lineCount <= MEDIUM_FILE_LINES) {
		return 4;
	}
	return 2; // very large — top-level keys + one level of children
}

// ── Minimal recursive-descent JSON parser ────────────────────────────────────
// Operates on the raw document text so we can map every key back to a line
// number.  We don't need to produce a JS value — only the structural outline.

export function parseJson(document: vscode.TextDocument): any[] {
	const text = document.getText();
	const lineCount = document.lineCount;
	const maxDepth = maxDepthForSize(lineCount);
	let pos = 0;

	// ── helpers ──
	function lineAt(offset: number): number {
		return document.positionAt(offset).line;
	}

	function skipWhitespace(): void {
		while (pos < text.length) {
			const ch = text[pos];
			if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
				pos++;
			} else if (ch === "/" && text[pos + 1] === "/") {
				// JSONC line comment
				while (pos < text.length && text[pos] !== "\n") {
					pos++;
				}
			} else if (ch === "/" && text[pos + 1] === "*") {
				// JSONC block comment
				pos += 2;
				while (
					pos < text.length &&
					!(text[pos] === "*" && text[pos + 1] === "/")
				) {
					pos++;
				}
				pos += 2;
			} else {
				break;
			}
		}
	}

	/** Skip over any JSON value without building outline nodes. */
	function skipValue(): void {
		skipWhitespace();
		if (pos >= text.length) {
			return;
		}
		const ch = text[pos];
		if (ch === '"') {
			skipString();
		} else if (ch === "{") {
			skipBraced("{", "}");
		} else if (ch === "[") {
			skipBraced("[", "]");
		} else {
			// literal: number, true, false, null
			while (
				pos < text.length &&
				text[pos] !== "," &&
				text[pos] !== "}" &&
				text[pos] !== "]" &&
				text[pos] !== "\n" &&
				text[pos] !== "\r" &&
				text[pos] !== " " &&
				text[pos] !== "\t"
			) {
				pos++;
			}
		}
	}

	function skipString(): void {
		if (text[pos] === '"') {
			pos++; // opening "
			while (pos < text.length && text[pos] !== '"') {
				if (text[pos] === "\\") {
					pos++;
				}
				pos++;
			}
			pos++; // closing "
		}
	}

	function skipBraced(open: string, close: string): void {
		let depth = 0;
		while (pos < text.length) {
			const ch = text[pos];
			if (ch === '"') {
				skipString();
				continue;
			}
			if (
				ch === "/" &&
				(text[pos + 1] === "/" || text[pos + 1] === "*")
			) {
				skipWhitespace();
				continue;
			}
			if (ch === open) {
				depth++;
			} else if (ch === close) {
				depth--;
				if (depth === 0) {
					pos++;
					return;
				}
			}
			pos++;
		}
	}

	/** Read a JSON string and return its content (unescaped). */
	function readString(): string {
		if (text[pos] !== '"') {
			return "";
		}
		pos++; // opening "
		let result = "";
		while (pos < text.length && text[pos] !== '"') {
			if (text[pos] === "\\") {
				pos++;
				if (pos < text.length) {
					result += text[pos];
				}
			} else {
				result += text[pos];
			}
			pos++;
		}
		pos++; // closing "
		return result;
	}

	/** Produce a short preview of a scalar value for the outline label. */
	function readScalarPreview(): string {
		skipWhitespace();
		if (pos >= text.length) {
			return "";
		}
		const ch = text[pos];
		if (ch === '"') {
			const s = readString();
			return s.length > 60 ? s.slice(0, 57) + "…" : s;
		}
		// number / bool / null — read until delimiter
		const start = pos;
		while (
			pos < text.length &&
			text[pos] !== "," &&
			text[pos] !== "}" &&
			text[pos] !== "]" &&
			text[pos] !== " " &&
			text[pos] !== "\t" &&
			text[pos] !== "\n" &&
			text[pos] !== "\r" &&
			text[pos] !== "/" // JSONC comment
		) {
			pos++;
		}
		return text.slice(start, pos);
	}

	// ── Main parser ──

	function parseObject(depth: number): any[] {
		const items: any[] = [];
		if (text[pos] !== "{") {
			return items;
		}
		pos++; // skip {

		skipWhitespace();
		while (pos < text.length && text[pos] !== "}") {
			skipWhitespace();
			if (pos >= text.length || text[pos] === "}") {
				break;
			}

			const keyLine = lineAt(pos);
			const key = readString();
			skipWhitespace();
			if (text[pos] === ":") {
				pos++; // skip :
			}
			skipWhitespace();

			if (depth >= maxDepth) {
				// Beyond the allowed depth — skip the value entirely
				skipValue();
			} else if (text[pos] === "{") {
				const children = parseObject(depth + 1);
				const item: any = {
					label: key,
					line: keyLine,
					jsonType: "object",
					isRegion: children.length > 0,
					children,
				};
				items.push(item);
			} else if (text[pos] === "[") {
				const children = parseArray(key, depth + 1);
				const item: any = {
					label: `${key}[]`,
					line: keyLine,
					jsonType: "array",
					isRegion: children.length > 0,
					children,
				};
				items.push(item);
			} else {
				// Scalar value
				const preview = readScalarPreview();
				items.push({
					label: preview ? `${key}: ${preview}` : key,
					line: keyLine,
					jsonType: "value",
					isRegion: false,
					children: [],
				});
			}

			skipWhitespace();
			if (text[pos] === ",") {
				pos++;
			}
		}
		if (text[pos] === "}") {
			pos++;
		}
		return items;
	}

	function parseArray(parentKey: string, depth: number): any[] {
		const items: any[] = [];
		if (text[pos] !== "[") {
			return items;
		}
		pos++; // skip [

		let index = 0;
		skipWhitespace();
		while (pos < text.length && text[pos] !== "]") {
			skipWhitespace();
			if (pos >= text.length || text[pos] === "]") {
				break;
			}

			const elemLine = lineAt(pos);

			if (depth >= maxDepth) {
				skipValue();
			} else if (text[pos] === "{") {
				const children = parseObject(depth + 1);
				// Try to find a recognizable "name" field in the object
				const nameChild = children.find(
					(c) =>
						c.jsonType === "value" &&
						/^(name|id|title|key|label|type):/i.test(c.label),
				);
				const label = nameChild
					? `[${index}] ${nameChild.label}`
					: `[${index}]`;
				items.push({
					label,
					line: elemLine,
					jsonType: "object",
					isRegion: children.length > 0,
					children,
				});
			} else if (text[pos] === "[") {
				const children = parseArray(`[${index}]`, depth + 1);
				items.push({
					label: `[${index}][]`,
					line: elemLine,
					jsonType: "array",
					isRegion: children.length > 0,
					children,
				});
			} else {
				const preview = readScalarPreview();
				items.push({
					label: `[${index}]: ${preview}`,
					line: elemLine,
					jsonType: "value",
					isRegion: false,
					children: [],
				});
			}

			index++;
			skipWhitespace();
			if (text[pos] === ",") {
				pos++;
			}
		}
		if (text[pos] === "]") {
			pos++;
		}
		return items;
	}

	// ── entry point ──
	skipWhitespace();
	if (pos >= text.length) {
		return [];
	}

	if (text[pos] === "{") {
		return parseObject(0);
	}
	if (text[pos] === "[") {
		return parseArray("root", 0);
	}
	return [];
}
