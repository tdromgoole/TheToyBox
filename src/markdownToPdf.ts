/**
 * markdownToPdf.ts
 *
 * Converts rendered markdown HTML (from markdownRenderer.ts) into raw
 * PDF-1.4 page content streams using the same assemblePdf infrastructure
 * as the code printer.
 *
 * Font resources (embedded as standard Type1):
 *   F1  Helvetica          — body text
 *   F2  Helvetica-Bold     — bold / headings
 *   F3  Helvetica-Oblique  — italic / em
 *   F4  Helvetica-BoldOblique — bold+italic
 *   F5  Courier            — code blocks / inline code
 *   F6  Courier-Bold
 *   F7  Courier-Oblique
 *   F8  Courier-BoldOblique
 *
 * Heading sizes (pts): h1=22 h2=18 h3=15 h4=13 h5=11 h6=10
 * Body text size: 10pt, line height 14pt
 * Code text size: 9pt, line height 13pt
 */

import { assemblePdf as _unused, PdfImage } from "./pdfAssembler.js"; // keep import tree connected
export { assemblePdf } from "./pdfAssembler.js";
export type { PdfImage } from "./pdfAssembler.js";
import {
	StyledRun,
	CODE_TOKENIZERS,
	buildStyledRuns,
	runsToLines,
} from "./codeTokenizer.js";

// ─── Page geometry ────────────────────────────────────────────────────────────
const W = 595; // A4 width  pts
const H = 842; // A4 height pts
const MX = 50; // horizontal margin
const MY = 52; // vertical margin
const CW = W - MX * 2; // content width

// ─── Font helpers ─────────────────────────────────────────────────────────────
const BODY_FS = 10;
const BODY_LH = 14;
const CODE_FS = 9;
const CODE_LH = 13;
const H_SIZES = [0, 22, 18, 15, 13, 11, 10]; // index = heading level 1–6

function bodyFont(bold: boolean, italic: boolean): string {
	if (bold && italic) {
		return "F4";
	}
	if (bold) {
		return "F2";
	}
	if (italic) {
		return "F3";
	}
	return "F1";
}
function codeFont(bold: boolean): string {
	return bold ? "F6" : "F5";
}

// ─── Colors ───────────────────────────────────────────────────────────────────
function pdfRgb(hex: string): string {
	const h = hex.startsWith("#") ? hex.slice(1) : hex;
	const r = parseInt(h.slice(0, 2), 16) / 255;
	const g = parseInt(h.slice(2, 4), 16) / 255;
	const b = parseInt(h.slice(4, 6), 16) / 255;
	return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

const C_BODY = pdfRgb("#1a1a1a"); // near-black body text
const C_HEAD = pdfRgb("#1f2328"); // dark heading
const C_DIM = pdfRgb("#57606a"); // secondary / dim
const C_CODE = pdfRgb("#0550ae"); // dark blue for code
const C_RULE = pdfRgb("#d0d7de"); // light gray rules
const C_META = pdfRgb("#57606a"); // header meta
const C_DEL = pdfRgb("#82071e"); // strikethrough
const C_STRONG = pdfRgb("#1f2328"); // bold

// Alert colors — readable on white paper
const ALERT_COLORS: Record<string, string> = {
	note: pdfRgb("#0969da"),
	tip: pdfRgb("#1a7f37"),
	important: pdfRgb("#8250df"),
	warning: pdfRgb("#9a6700"),
	caution: pdfRgb("#cf222e"),
};
const ALERT_BG: Record<string, string> = {
	note: pdfRgb("#ddf4ff"),
	tip: pdfRgb("#dafbe1"),
	important: pdfRgb("#fbefff"),
	warning: pdfRgb("#fff8c5"),
	caution: pdfRgb("#ffebe9"),
};
const ALERT_TITLE_C: Record<string, string> = {
	note: pdfRgb("#0550ae"),
	tip: pdfRgb("#116329"),
	important: pdfRgb("#6639ba"),
	warning: pdfRgb("#7d4e00"),
	caution: pdfRgb("#a40e26"),
};

// Maps fenced-code-block language identifiers to the extensions CODE_TOKENIZERS recognises
const LANG_TO_EXT: Record<string, string> = {
	js: ".js",
	javascript: ".js",
	mjs: ".js",
	cjs: ".js",
	ts: ".ts",
	typescript: ".ts",
	jsx: ".jsx",
	tsx: ".tsx",
	kdl: ".kdl",
	asp: ".asp",
	vbhtml: ".vbhtml",
	php: ".php",
	nginx: ".conf",
	conf: ".conf",
	http: ".http",
	https: ".http",
	bash: ".bash",
	sh: ".sh",
	shell: ".sh",
};

// ─── PDF string escape ────────────────────────────────────────────────────────
function esc(text: string): string {
	text = text.replace(/\t/g, "    ");
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		if (c === 40) {
			out += "\\(";
		} else if (c === 41) {
			out += "\\)";
		} else if (c === 92) {
			out += "\\\\";
		} else if (c >= 32 && c <= 126) {
			out += text[i];
		} else if (c > 126 && c <= 255) {
			out += "\\" + c.toString(8).padStart(3, "0");
		} else {
			out += " ";
		}
	}
	return out;
}

// ─── Approximate string width in pts for a given font size ───────────────────
// Courier: fixed 0.6 × fs  |  Helvetica: average ~0.5 × fs (rough approx)
function approxWidth(text: string, fs: number, mono: boolean): number {
	return mono ? text.length * fs * 0.6 : text.length * fs * 0.5;
}

// ─── Inline HTML parser ───────────────────────────────────────────────────────
// Breaks a line of inline HTML into styled spans.
interface InlineSpan {
	text: string;
	bold: boolean;
	italic: boolean;
	del: boolean;
	code: boolean;
	link: boolean;
}

function parseInlineHtml(html: string): InlineSpan[] {
	const spans: InlineSpan[] = [];
	let bold = false,
		italic = false,
		del = false,
		code = false,
		link = false;
	let i = 0;
	let buf = "";

	function flush(): void {
		if (buf) {
			// Decode HTML entities — numeric first, then named
			const text = buf
				.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
					const c = parseInt(h, 16);
					return c >= 32 && c <= 255
						? String.fromCharCode(c)
						: c > 255
							? "?"
							: " ";
				})
				.replace(/&#(\d+);/g, (_, n) => {
					const c = parseInt(n, 10);
					return c >= 32 && c <= 255
						? String.fromCharCode(c)
						: c > 255
							? "?"
							: " ";
				})
				.replace(/&amp;/g, "&")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/&quot;/g, '"')
				.replace(/&apos;/g, "'")
				.replace(/&nbsp;/g, " ")
				.replace(/&#x2713;/g, "\u2713")
				.replace(/&bull;/g, "\xB7")
				.replace(/&[a-z]+;/g, " ");
			spans.push({ text, bold, italic, del, code, link });
			buf = "";
		}
	}

	while (i < html.length) {
		if (html[i] !== "<") {
			buf += html[i++];
			continue;
		}
		// We're at a tag
		const end = html.indexOf(">", i);
		if (end === -1) {
			buf += html[i++];
			continue;
		}
		const tag = html
			.slice(i + 1, end)
			.trim()
			.toLowerCase();
		flush();
		i = end + 1;
		if (tag === "strong" || tag === "b") {
			bold = true;
		} else if (tag === "/strong" || tag === "/b") {
			bold = false;
		} else if (tag === "em" || tag === "i") {
			italic = true;
		} else if (tag === "/em" || tag === "/i") {
			italic = false;
		} else if (tag === "del") {
			del = true;
		} else if (tag === "/del") {
			del = false;
		} else if (tag === "code") {
			code = true;
		} else if (tag === "/code") {
			code = false;
		} else if (tag.startsWith("a ") || tag === "a") {
			link = true;
		} else if (tag === "/a") {
			link = false;
		} else if (tag === "br" || tag === "br/") {
			spans.push({ text: "\n", bold, italic, del, code, link });
		}
		// ignore img, span, etc.
	}
	flush();
	return spans;
}

// ─── Block extraction ─────────────────────────────────────────────────────────
type BlockType =
	| { kind: "h"; level: number; html: string }
	| { kind: "p"; html: string }
	| { kind: "pre"; text: string; lang?: string }
	| { kind: "hr" }
	| { kind: "ul"; items: string[] }
	| { kind: "ol"; items: string[]; start: number }
	| { kind: "table"; head: string[][]; rows: string[][] }
	| { kind: "alert"; type: string; titleHtml: string; bodyHtml: string }
	| { kind: "task"; items: Array<{ checked: boolean; html: string }> }
	| { kind: "img"; data: Buffer; widthPx: number; heightPx: number };

/** Very lightweight HTML block extractor. Input is the output of renderMarkdownToHtml. */
function extractBlocks(html: string): BlockType[] {
	const blocks: BlockType[] = [];
	let i = 0;

	function consumeTag(name: string): string | null {
		const openRe = new RegExp(`^<${name}(?:\\s[^>]*)?>`, "i");
		const m = html.slice(i).match(openRe);
		if (!m) {
			return null;
		}
		const start = i + m[0].length;
		const closeTag = `</${name}>`;
		const end = html.toLowerCase().indexOf(closeTag, start);
		if (end === -1) {
			return null;
		}
		const inner = html.slice(start, end);
		i = end + closeTag.length;
		// skip whitespace
		while (
			i < html.length &&
			(html[i] === "\n" || html[i] === "\r" || html[i] === " ")
		) {
			i++;
		}
		return inner;
	}

	while (i < html.length) {
		// skip whitespace
		while (
			i < html.length &&
			(html[i] === "\n" || html[i] === "\r" || html[i] === " ")
		) {
			i++;
		}
		if (i >= html.length) {
			break;
		}

		// Heading
		const hMatch = html
			.slice(i)
			.match(/^<h([1-6])(?:\s[^>]*)?>(.+?)<\/h[1-6]>/is);
		if (hMatch) {
			blocks.push({
				kind: "h",
				level: Number(hMatch[1]),
				html: hMatch[2],
			});
			i += hMatch[0].length;
			continue;
		}

		// Alert div
		const alertMatch = html
			.slice(i)
			.match(/^<div class="markdown-alert ([^"]+)">/i);
		if (alertMatch) {
			const alertType = alertMatch[1].trim();
			const divStart = i + alertMatch[0].length;
			// Find closing </div>
			const closeDiv = html.toLowerCase().indexOf("</div>", divStart);
			if (closeDiv !== -1) {
				const inner = html.slice(divStart, closeDiv);
				i = closeDiv + "</div>".length;
				// Extract title and body paragraph
				const titleMatch = inner.match(
					/<p class="alert-title">(.*?)<\/p>/is,
				);
				const bodyMatch = inner.match(/<p>(.*?)<\/p>/is);
				const titleHtml = titleMatch ? titleMatch[1] : "";
				const bodyHtml = bodyMatch ? bodyMatch[1] : "";
				blocks.push({
					kind: "alert",
					type: alertType,
					titleHtml,
					bodyHtml,
				});
				continue;
			}
		}

		// HR
		if (html.slice(i).match(/^<hr\s*\/?>/i)) {
			const m = html.slice(i).match(/^<hr\s*\/?>/i)!;
			blocks.push({ kind: "hr" });
			i += m[0].length;
			continue;
		}

		// Pre / code block — allow attributes on both <pre> and <code>
		const preMatch = html
			.slice(i)
			.match(
				/^<pre(?:[^>]*)>(<code(?:[^>]*)>)?([\s\S]*?)(?:<\/code>)?<\/pre>/i,
			);
		if (preMatch) {
			const codeTag = preMatch[1] ?? "";
			const langMatch = codeTag.match(/class="language-([^"\s]+)"/i);
			blocks.push({
				kind: "pre",
				lang: langMatch?.[1],
				text: preMatch[2]
					.replace(/&amp;/g, "&")
					.replace(/&lt;/g, "<")
					.replace(/&gt;/g, ">")
					.replace(/&quot;/g, '"'),
			});
			i += preMatch[0].length;
			continue;
		}

		// Task list
		const taskListMatch = html
			.slice(i)
			.match(/^<ul class="task-list">([\s\S]*?)<\/ul>/i);
		if (taskListMatch) {
			const items: Array<{ checked: boolean; html: string }> = [];
			const liRe =
				/<li class="task-item"><span class="task-box([^"]*)">[^<]*<\/span>([\s\S]*?)<\/li>/gi;
			let m: RegExpExecArray | null;
			while ((m = liRe.exec(taskListMatch[1])) !== null) {
				items.push({
					checked: m[1].includes("task-checked"),
					html: m[2],
				});
			}
			blocks.push({ kind: "task", items });
			i += taskListMatch[0].length;
			continue;
		}

		// Unordered list
		const ulInner = consumeTag("ul");
		if (ulInner !== null) {
			const items: string[] = [];
			const liRe = /<li(?:[^>]*)>([\s\S]*?)<\/li>/gi;
			let m: RegExpExecArray | null;
			while ((m = liRe.exec(ulInner)) !== null) {
				items.push(m[1]);
			}
			blocks.push({ kind: "ul", items });
			continue;
		}

		// Ordered list — allow any attributes, extract start separately
		const olAttr = html.slice(i).match(/^<ol(?:[^>]*)>/i);
		const olStart = html.slice(i).match(/^<ol[^>]*\bstart="(\d+)"/i);
		if (olAttr) {
			const start = olStart ? Number(olStart[1]) : 1;
			i += olAttr[0].length;
			const end = html.toLowerCase().indexOf("</ol>", i);
			if (end !== -1) {
				const inner = html.slice(i, end);
				i = end + "</ol>".length;
				while (
					i < html.length &&
					(html[i] === "\n" || html[i] === " ")
				) {
					i++;
				}
				const items: string[] = [];
				const liRe = /<li(?:[^>]*)>([\s\S]*?)<\/li>/gi;
				let m: RegExpExecArray | null;
				while ((m = liRe.exec(inner)) !== null) {
					items.push(m[1]);
				}
				blocks.push({ kind: "ol", items, start });
				continue;
			}
		}

		// Table — allow attributes on <table>, <thead>, <tbody>, <tr>
		const tableMatch = html
			.slice(i)
			.match(/^<table(?:[^>]*)>([\s\S]*?)<\/table>/i);
		if (tableMatch) {
			const headMatch = tableMatch[1].match(
				/<thead(?:[^>]*)>([\s\S]*?)<\/thead>/i,
			);
			const bodyMatch = tableMatch[1].match(
				/<tbody(?:[^>]*)>([\s\S]*?)<\/tbody>/i,
			);
			function extractCells(rowHtml: string, tag: string): string[][] {
				const rows: string[][] = [];
				const trRe = /<tr(?:[^>]*)>([\s\S]*?)<\/tr>/gi;
				let tr: RegExpExecArray | null;
				while ((tr = trRe.exec(rowHtml)) !== null) {
					const cells: string[] = [];
					const tdRe = new RegExp(
						`<${tag}(?:[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
						"gi",
					);
					let td: RegExpExecArray | null;
					while ((td = tdRe.exec(tr[1])) !== null) {
						cells.push(td[1]);
					}
					rows.push(cells);
				}
				return rows;
			}
			const head = headMatch ? extractCells(headMatch[1], "th") : [];
			const rows = bodyMatch ? extractCells(bodyMatch[1], "td") : [];
			blocks.push({ kind: "table", head, rows });
			i += tableMatch[0].length;
			continue;
		}

		// Inline image from DOM serializer (data:image/jpeg;base64 JPEG)
		if (/^<img\b/i.test(html.slice(i))) {
			const tagEnd = html.indexOf(">", i);
			if (tagEnd !== -1) {
				const tagStr = html.slice(i, tagEnd + 1);
				const srcM = tagStr.match(
					/\bsrc="data:image\/jpeg;base64,([^"]+)"/i,
				);
				const wM = tagStr.match(/\bwidth="(\d+)"/i);
				const hM = tagStr.match(/\bheight="(\d+)"/i);
				if (srcM) {
					blocks.push({
						kind: "img",
						data: Buffer.from(srcM[1], "base64"),
						widthPx: wM ? Number(wM[1]) : 800,
						heightPx: hM ? Number(hM[1]) : 400,
					});
				}
				i = tagEnd + 1;
				while (
					i < html.length &&
					(html[i] === "\n" || html[i] === "\r" || html[i] === " ")
				)
					{i++;}
				continue;
			}
		}

		// Block containers (div, section, article, etc.) — recurse into inner content
		const bcMatch = html
			.slice(i)
			.match(
				/^<(div|section|article|main|header|footer|blockquote)(?:\s[^>]*)?>/i,
			);
		if (bcMatch) {
			const tagName = bcMatch[1].toLowerCase();
			const afterOpen = i + bcMatch[0].length;
			const closingTag = `</${tagName}>`;
			const lo = html.toLowerCase();
			let depth = 1;
			let j = afterOpen;
			let closeAt = -1;
			while (j < lo.length) {
				const nOpen = lo.indexOf(`<${tagName}`, j);
				const nClose = lo.indexOf(closingTag, j);
				if (nClose === -1) {break;}
				if (nOpen !== -1 && nOpen < nClose) {
					const ca = lo[nOpen + tagName.length + 1] ?? "";
					if (
						ca === ">" ||
						ca === " " ||
						ca === "\t" ||
						ca === "\n" ||
						ca === "\r" ||
						ca === "/"
					) {
						depth++;
					}
					j = nOpen + tagName.length + 1;
				} else {
					depth--;
					if (depth === 0) {
						closeAt = nClose;
						break;
					}
					j = nClose + closingTag.length;
				}
			}
			if (closeAt !== -1) {
				const innerBlocks = extractBlocks(
					html.slice(afterOpen, closeAt),
				);
				blocks.push(...innerBlocks);
				i = closeAt + closingTag.length;
			} else {
				i += bcMatch[0].length; // unclosed tag — skip open tag
			}
			while (
				i < html.length &&
				(html[i] === "\n" ||
					html[i] === "\r" ||
					html[i] === " " ||
					html[i] === "\t")
			) {
				i++;
			}
			continue;
		}

		// Paragraph
		const pInner = consumeTag("p");
		if (pInner !== null) {
			blocks.push({ kind: "p", html: pInner });
			continue;
		}

		// Plain text line (fallback)
		const nlIdx = html.indexOf("\n", i);
		const lineEnd = nlIdx === -1 ? html.length : nlIdx + 1;
		const raw = html.slice(i, lineEnd).trim();
		if (raw) {
			blocks.push({ kind: "p", html: raw });
		}
		i = lineEnd;
	}

	return blocks;
}

/** Diagnostic summary of the private HTML block extraction stage. */
export function describeMarkdownPdfBlocks(html: string): string[] {
	return extractBlocks(html).map((block, index) => {
		if (block.kind === "alert") {
			return `${index}:alert:${block.type}:title=${block.titleHtml}:body=${block.bodyHtml}`;
		}
		return `${index}:${block.kind}`;
	});
}

// ─── Word-wrap ────────────────────────────────────────────────────────────────
interface WrappedLine {
	spans: InlineSpan[];
}

function wrapInlineSpans(
	spans: InlineSpan[],
	maxWidth: number,
	fs: number,
): WrappedLine[] {
	const lines: WrappedLine[] = [];
	let currentLine: InlineSpan[] = [];
	let lineWidth = 0;

	for (const span of spans) {
		const words = span.text.split(/(\s+)/);
		for (const word of words) {
			const mono = span.code;
			const ww = approxWidth(word, fs, mono);
			if (lineWidth + ww > maxWidth && lineWidth > 0 && word.trim()) {
				lines.push({ spans: currentLine });
				currentLine = [];
				lineWidth = 0;
			}
			const trimmedWord = word.replace(/^\s+/, "");
			if (trimmedWord || currentLine.length > 0) {
				currentLine.push({
					...span,
					text: lineWidth === 0 ? trimmedWord : word,
				});
				lineWidth += approxWidth(
					lineWidth === 0 ? trimmedWord : word,
					fs,
					mono,
				);
			}
		}
	}
	if (currentLine.length) {
		lines.push({ spans: currentLine });
	}
	return lines;
}

// ─── Page builder ─────────────────────────────────────────────────────────────
export function buildMarkdownPdfPages(
	html: string,
	fileName: string,
	date: string,
	languageLabel = "Markdown",
	imageCollector?: PdfImage[],
	codeHighlighter?: (text: string, language: string) => StyledRun[][] | undefined,
): string[] {
	const blocks = extractBlocks(html);
	const pages: string[] = [];
	const parts: string[] = [];
	let y = H - MY;
	let pageNum = 0;
	let imageCounter = 0;

	function strokeRule(yy: number, thick: number, color: string): void {
		parts.push(
			`q\n${color} ${color.replace(/ rg$/, " RG")}\n${thick} w\n` +
				`${MX} ${yy} m ${W - MX} ${yy} l S\nQ\n`,
		);
	}

	function startPage(isFirst: boolean): void {
		pageNum++;
		parts.length = 0;
		y = H - MY;

		if (isFirst) {
			// file header
			parts.push(`BT\n/F2 11 Tf\n${MX} ${y} Td\n`);
			parts.push(`${C_HEAD} rg (${esc(fileName)}) Tj\nET\n`);
			y -= 15;
			parts.push(`BT\n/F1 8 Tf\n${MX} ${y} Td\n`);
			const bullet = "\xB7";
			parts.push(
				`${C_META} rg (${esc(languageLabel)}   ${bullet}   ${esc(date)}) Tj\nET\n`,
			);
			y -= 6;
			strokeRule(y, 0.5, `${C_RULE} rg`);
			y -= 14;
		}
	}

	function endPage(): void {
		const footerY = MY - 14;
		strokeRule(footerY + 10, 0.25, `${C_RULE} rg`);
		const pg = `Page ${pageNum}`;
		const pgX = ((W - approxWidth(pg, 8, false)) / 2).toFixed(1);
		parts.push(
			`BT\n/F1 8 Tf\n${pgX} ${footerY} Td\n${C_META} rg (${esc(pg)}) Tj\nET\n`,
		);
		pages.push(parts.join(""));
	}

	function needSpace(needed: number): void {
		if (y - needed < MY + 24) {
			endPage();
			startPage(false);
		}
	}

	// ── Emit inline text (handles word-wrap, bold/italic/code) ───────────────
	function emitInlineText(
		inlineHtml: string,
		fs: number,
		lh: number,
		indent: number,
		color: string,
	): void {
		const allSpans = parseInlineHtml(inlineHtml);
		const wrappedLines = wrapInlineSpans(allSpans, CW - indent, fs);
		for (const wl of wrappedLines) {
			needSpace(lh);
			parts.push(`BT\n${MX + indent} ${y} Td\n`);
			for (const sp of wl.spans) {
				if (!sp.text) {
					continue;
				}
				const font = sp.code
					? codeFont(sp.bold)
					: bodyFont(sp.bold, sp.italic);
				const spFs = sp.code ? CODE_FS : fs;
				const c = sp.del
					? C_DEL
					: sp.link
						? pdfRgb("#0969da")
						: sp.code
							? C_CODE
							: color;
				parts.push(
					`/${font} ${spFs} Tf\n${c} rg (${esc(sp.text)}) Tj\n`,
				);
			}
			parts.push(`ET\n`);
			y -= lh;
		}
	}

	function emitParagraphSpacing(): void {
		y -= 6;
	}

	startPage(true);

	for (const block of blocks) {
		switch (block.kind) {
			case "h": {
				const fs = H_SIZES[block.level] ?? BODY_FS;
				const lh = fs + 5;
				const topMargin = block.level <= 2 ? 14 : 10;
				needSpace(lh + topMargin + 14);
				y -= topMargin;
				const headingBaseline = y;
				emitInlineText(block.html, fs, lh, 0, C_HEAD);
				if (block.level <= 2) {
					// Anchor the divider to the visible text rather than the full
					// heading line box, matching GitHub/VS Code Markdown spacing.
					const ruleY = headingBaseline - 9;
					strokeRule(ruleY, 0.4, `${C_RULE} rg`);
					y = ruleY - 10;
				}
				emitParagraphSpacing();
				break;
			}

			case "p": {
				emitInlineText(block.html, BODY_FS, BODY_LH, 0, C_BODY);
				emitParagraphSpacing();
				break;
			}

			case "pre": {
				const shikiRuns = block.lang
					? codeHighlighter?.(block.text, block.lang)
					: undefined;
				const ext = LANG_TO_EXT[(block.lang ?? "").toLowerCase()] ?? "";
				const profile = ext
					? CODE_TOKENIZERS.find((p) => p.extensions.includes(ext))
					: undefined;
				const lineRuns: StyledRun[][] = shikiRuns ?? (profile
					? runsToLines(
							buildStyledRuns(
								block.text,
								profile.tokenize(block.text),
							),
						)
					: block.text
							.split("\n")
							.map((l) => (l ? [{ text: l }] : [])));

				const lineCount = lineRuns.length;
				const blockH = lineCount * CODE_LH + 16;
				needSpace(Math.min(blockH, (H - MY * 2) / 2));
				parts.push(
					`q\n0.965 0.969 0.976 rg\n` +
						`${MX} ${y - lineCount * CODE_LH - 8} ${CW} ${lineCount * CODE_LH + 16} re f\nQ\n`,
				);
				y -= 8;
				for (const runs of lineRuns) {
					needSpace(CODE_LH);
					if (runs.length > 0) {
						parts.push(`BT\n${MX + 8} ${y} Td\n`);
						for (const run of runs) {
							const font =
								run.bold && run.italic
									? "F8"
									: run.bold
										? "F6"
										: run.italic
											? "F7"
											: "F5";
							const color = run.color
								? pdfRgb(run.color)
								: profile
									? C_BODY
									: C_CODE;
							parts.push(
								`/${font} ${CODE_FS} Tf\n${color} rg (${esc(run.text)}) Tj\n`,
							);
						}
						parts.push(`ET\n`);
					}
					y -= CODE_LH;
				}
				y -= 8;
				emitParagraphSpacing();
				break;
			}

			case "hr": {
				needSpace(16);
				y -= 8;
				strokeRule(y, 0.5, `${C_RULE} rg`);
				y -= 16;
				break;
			}

			case "ul": {
				for (const item of block.items) {
					emitInlineText(
						`\xB7  ${item}`,
						BODY_FS,
						BODY_LH,
						12,
						C_BODY,
					);
				}
				emitParagraphSpacing();
				break;
			}

			case "ol": {
				block.items.forEach((item, idx) => {
					emitInlineText(
						`${block.start + idx}.  ${item}`,
						BODY_FS,
						BODY_LH,
						12,
						C_BODY,
					);
				});
				emitParagraphSpacing();
				break;
			}

			case "task": {
				for (const item of block.items) {
					needSpace(BODY_LH);
					const boxX = MX + 1;
					const boxY = y - 2;
					parts.push(
						`q\n${C_DIM} RG\n0.8 w\n${boxX} ${boxY} 8 8 re S\nQ\n`,
					);
					if (item.checked) {
						parts.push(
							`q\n${C_HEAD} RG\n1.2 w\n` +
								`${boxX + 1.5} ${boxY + 4} m ${boxX + 3.5} ${boxY + 2} l ` +
								`${boxX + 7} ${boxY + 6.5} l S\nQ\n`,
						);
					}
					emitInlineText(
						item.html,
						BODY_FS,
						BODY_LH,
						15,
						C_BODY,
					);
				}
				emitParagraphSpacing();
				break;
			}

			case "table": {
				const allRows = [
					...block.head.map((r) => ({ cells: r, header: true })),
					...block.rows.map((r) => ({ cells: r, header: false })),
				];
				if (!allRows.length) {
					break;
				}
				const colCount = allRows[0].cells.length;
				const HPAD = 6;
				const ROW_ASCENT = 10; // pts above first-line baseline inside row
				const ROW_DESCENT = 5; // pts below last-line baseline inside row

				// Distribute column widths proportional to max natural content width
				const colMaxW = Array<number>(colCount).fill(0);
				for (const row of allRows) {
					row.cells.forEach((cell, ci) => {
						const w = parseInlineHtml(cell).reduce(
							(s, sp) =>
								s + approxWidth(sp.text, BODY_FS, sp.code),
							0,
						);
						colMaxW[ci] = Math.max(colMaxW[ci], w);
					});
				}
				const totalMaxW = colMaxW.reduce((a, b) => a + b, 0) || 1;
				// each column gets at least half of an equal-split share
				const minColW = CW / (colCount * 2);
				let colWs = colMaxW.map((w) =>
					Math.max((w / totalMaxW) * CW, minColW),
				);
				const scaleW = CW / colWs.reduce((a, b) => a + b, 0);
				colWs = colWs.map((w) => w * scaleW);

				let pastHeader = false;

				for (const row of allRows) {
					const isFirstBody = !row.header && !pastHeader;
					if (!row.header) {pastHeader = true;}

					const wrapped = row.cells.map((cell, ci) =>
						wrapInlineSpans(
							parseInlineHtml(cell),
							colWs[ci] - HPAD * 2,
							BODY_FS,
						),
					);
					const maxLines = Math.max(
						1,
						...wrapped.map((w) => w.length),
					);
					const rowH =
						ROW_ASCENT + (maxLines - 1) * BODY_LH + ROW_DESCENT;
					needSpace(rowH + 1);

					// ruleY = top edge of this row; rows touch exactly so there is
					// no gap for the background-fill of the next row to cover the rule
					const ruleY = y + ROW_ASCENT;

					// Row background
					parts.push(
						`q\n${row.header ? "0.910 0.918 0.926 rg" : "0.980 0.982 0.984 rg"}\n` +
							`${MX} ${ruleY - rowH} ${CW} ${rowH} re f\nQ\n`,
					);

					// Top rule drawn after fill so it is not covered
					const ruleThick = isFirstBody ? "0.8" : "0.4";
					parts.push(
						`q\n${C_RULE} RG\n${ruleThick} w\n` +
							`${MX} ${ruleY} m ${MX + CW} ${ruleY} l S\nQ\n`,
					);

					// Cell text
					let colX = MX;
					wrapped.forEach((lines, ci) => {
						const cx = colX + HPAD;
						lines.forEach((wl, li) => {
							if (!wl.spans.some((s) => s.text)) {return;}
							parts.push(`BT\n${cx} ${y - li * BODY_LH} Td\n`);
							for (const sp of wl.spans) {
								if (!sp.text) {continue;}
								const isCode = sp.code && !row.header;
								const font = isCode
									? codeFont(sp.bold)
									: bodyFont(
											row.header || sp.bold,
											sp.italic,
										);
								const color = isCode
									? C_CODE
									: sp.del
										? C_DEL
										: sp.link
											? pdfRgb("#0969da")
											: row.header
												? C_HEAD
												: C_BODY;
								parts.push(
									`/${font} ${BODY_FS} Tf\n${color} rg (${esc(sp.text)}) Tj\n`,
								);
							}
							parts.push(`ET\n`);
						});
						colX += colWs[ci];
					});

					// Vertical column separators
					colX = MX;
					for (let ci = 0; ci < colCount - 1; ci++) {
						colX += colWs[ci];
						parts.push(
							`q\n${C_RULE} RG\n0.4 w\n` +
								`${colX} ${ruleY - rowH} m ${colX} ${ruleY} l S\nQ\n`,
						);
					}

					y -= rowH;
				}

				// Bottom border
				parts.push(
					`q\n${C_RULE} RG\n0.4 w\n` +
						`${MX} ${y + ROW_ASCENT} m ${MX + CW} ${y + ROW_ASCENT} l S\nQ\n`,
				);

				emitParagraphSpacing();
				break;
			}

			case "alert": {
				const ALERT_TOP_PAD = 16;
				const ALERT_BOTTOM_PAD = 10;
				const ALERT_BOTTOM_MARGIN = 12;
				const ALERT_TITLE_GAP = 4;
				const alertLines = parseInlineHtml(block.bodyHtml);
				const wrappedBody = wrapInlineSpans(
					alertLines,
					CW - 24,
					BODY_FS,
				);
				const alertH =
					ALERT_TOP_PAD +
					BODY_LH +
					ALERT_TITLE_GAP +
					wrappedBody.length * BODY_LH +
					ALERT_BOTTOM_PAD;
				needSpace(alertH + ALERT_BOTTOM_MARGIN);

				const ac = ALERT_COLORS[block.type] ?? ALERT_COLORS.note;
				const bg = ALERT_BG[block.type] ?? ALERT_BG.note;
				const tc = ALERT_TITLE_C[block.type] ?? ALERT_TITLE_C.note;
				const bottom = y - alertH;

				// Background
				parts.push(
					`q\n${bg} rg\n${MX} ${bottom} ${CW} ${alertH} re f\nQ\n`,
				);
				// Left border bar
				parts.push(
					`q\n${ac} rg\n${MX} ${bottom} 4 ${alertH} re f\nQ\n`,
				);

				y -= ALERT_TOP_PAD;

				// Material Symbols are font ligatures and cannot be embedded using the
				// PDF's standard fonts. Remove the source span before parsing so its
				// ligature name (for example, "info") never leaks into printed text.
				const titleHtml = block.titleHtml.replace(
					/<span\b[^>]*class=["'][^"']*\balert-icon\b[^"']*["'][^>]*>[\s\S]*?<\/span>\s*/i,
					"",
				);
				const titleSpans = parseInlineHtml(titleHtml);
				if (titleSpans.length) {
					// Draw a resolution-independent circled callout glyph.
					const iconX = MX + 19;
					const iconY = y + 3;
					const radius = 6;
					const bezier = 3.314;
					parts.push(
						`q\n${tc} RG\n1.2 w\n` +
							`${iconX + radius} ${iconY} m ` +
							`${iconX + radius} ${iconY + bezier} ${iconX + bezier} ${iconY + radius} ${iconX} ${iconY + radius} c ` +
							`${iconX - bezier} ${iconY + radius} ${iconX - radius} ${iconY + bezier} ${iconX - radius} ${iconY} c ` +
							`${iconX - radius} ${iconY - bezier} ${iconX - bezier} ${iconY - radius} ${iconX} ${iconY - radius} c ` +
							`${iconX + bezier} ${iconY - radius} ${iconX + radius} ${iconY - bezier} ${iconX + radius} ${iconY} c S\nQ\n`,
					);
					const iconLabel = block.type === "note" ? "i" : "!";
					parts.push(
						`BT\n/F2 8 Tf\n${iconX - 1.5} ${iconY - 2.5} Td\n${tc} rg (${iconLabel}) Tj\nET\n`,
					);
					parts.push(
						`BT\n/F2 ${BODY_FS} Tf\n${MX + 32} ${y} Td\n${tc} rg `,
					);
					for (const s of titleSpans) {
						parts.push(`(${esc(s.text)}) Tj `);
					}
					parts.push(`\nET\n`);
					y -= BODY_LH + ALERT_TITLE_GAP;
				}

				// Body
				for (const wl of wrappedBody) {
					parts.push(
						`BT\n/F1 ${BODY_FS} Tf\n${MX + 12} ${y} Td\n${C_BODY} rg `,
					);
					for (const s of wl.spans) {
						parts.push(`(${esc(s.text)}) Tj `);
					}
					parts.push(`\nET\n`);
					y -= BODY_LH;
				}
				y -= ALERT_BOTTOM_PAD;
				y -= ALERT_BOTTOM_MARGIN;
				break;
			}

			case "img": {
				// Scale to fit content width, never scale up, cap at 70% of content height
				const maxW = CW;
				const maxH = (H - MY * 2) * 0.7;
				const scaleW = maxW / block.widthPx;
				const scaleH = maxH / block.heightPx;
				const scale = Math.min(1, scaleW, scaleH);
				const dw = Math.round(block.widthPx * scale);
				const dh = Math.round(block.heightPx * scale);

				needSpace(dh + 10);

				const imgName = `Im${imageCounter++}`;
				// Center horizontally in the content area
				const imgX = MX + (CW - dw) / 2;
				const imgY = y - dh;
				// PDF image operator: q <w> 0 0 <h> <x> <y> cm /<name> Do Q
				parts.push(
					`q\n${dw} 0 0 ${dh} ${imgX.toFixed(1)} ${imgY.toFixed(1)} cm\n/${imgName} Do\nQ\n`,
				);
				y -= dh + 10;

				if (imageCollector) {
					imageCollector.push({
						name: imgName,
						data: block.data,
						width: block.widthPx,
						height: block.heightPx,
					});
				}
				emitParagraphSpacing();
				break;
			}
		}
	}

	endPage();
	return pages;
}

// ─── Font resource map for assemblePdf ───────────────────────────────────────
/** Returns the font resource dictionary entries for the 8-font markdown set. */
export const MARKDOWN_PDF_FONTS: Array<{ name: string; base: string }> = [
	{ name: "F1", base: "Helvetica" },
	{ name: "F2", base: "Helvetica-Bold" },
	{ name: "F3", base: "Helvetica-Oblique" },
	{ name: "F4", base: "Helvetica-BoldOblique" },
	{ name: "F5", base: "Courier" },
	{ name: "F6", base: "Courier-Bold" },
	{ name: "F7", base: "Courier-Oblique" },
	{ name: "F8", base: "Courier-BoldOblique" },
];
