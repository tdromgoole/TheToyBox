import { skipBracedBlock } from "./syntax/sqlScanner.js";

/** Conservatively leave lines containing multiline literal data untouched. */
export function literalLines(text: string, language: string): Set<number> {
	const protectedLines = new Set<number>();
	let line = 0;
	let i = 0;
	const php = language === "php";
	// PHP files can contain ordinary HTML prose. Quotes in that prose are not
	// PHP strings and must not suppress cleanup in subsequent PHP blocks.
	let inPhp = !php || !/<\?(?:php\b|=)/i.test(text);
	const hashComments = /^(php|python|ruby|shellscript|powershell|perl)$/.test(language);
	const protect = (start: number) => {
		for (let n = start; n <= line; n++) { protectedLines.add(n); }
	};
	while (i < text.length) {
		if (text[i] === "\n") { line++; i++; continue; }
		if (php && !inPhp) {
			const opening = text.slice(i).match(/^<\?(?:php\b|=)/i);
			if (opening) { i += opening[0].length; inPhp = true; }
			else { i++; }
			continue;
		}
		if (php && text.startsWith("?>", i)) { inPhp = false; i += 2; continue; }
		if (text.startsWith("//", i) || (hashComments && text[i] === "#")) {
			while (i < text.length && text[i] !== "\n" && !(php && text.startsWith("?>", i))) { i++; }
			continue;
		}
		if (text.startsWith("/*", i)) {
			i += 2;
			while (i < text.length && !text.startsWith("*/", i)) {
				if (text[i++] === "\n") { line++; }
			}
			i += 2;
			continue;
		}
		const heredoc = language === "php" ? text.slice(i).match(/^<<<[ \t]*['"]?([A-Za-z_]\w*)['"]?[^\S\n]*\r?\n/) : null;
		if (heredoc) {
			const start = line;
			i += heredoc[0].length;
			line++;
			const closing = new RegExp(`^[ \\t]*${heredoc[1]}\\b`, "m");
			const end = closing.exec(text.slice(i));
			const stop = end ? i + end.index + end[0].length : text.length;
			while (i < stop) { if (text[i++] === "\n") { line++; } }
			protect(start);
			continue;
		}
		const ch = text[i];
		if (ch === "'" || ch === '"' || ch === "`") {
			const start = line;
			const delimiter = text.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch;
			i += delimiter.length;
			let closed = false;
			while (i < text.length) {
				if (php && ch === '"' && (text.startsWith("{$", i) || text.startsWith("${", i))) {
					const end = skipBracedBlock(text, text[i] === "{" ? i : i + 1);
					while (i < end) { if (text[i++] === "\n") { line++; } }
					continue;
				}
				if (ch === "`" && text.startsWith("${", i)) {
					const end = skipBracedBlock(text, i + 1);
					while (i < end) { if (text[i++] === "\n") { line++; } }
					continue;
				}
				if (text[i] === "\\") {
					if (text[i + 1] === "\n") { line++; }
					i += 2;
					continue;
				}
				if (text.startsWith(delimiter, i)) {
					i += delimiter.length;
					closed = true;
					break;
				}
				if (text[i++] === "\n") { line++; }
			}
			if (line > start || !closed) { protect(start); }
			continue;
		}
		i++;
	}
	return protectedLines;
}
