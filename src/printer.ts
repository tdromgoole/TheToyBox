import * as vscode from "vscode";
import * as path from "path";
import { randomBytes } from "crypto";
import { TokenMatch } from "./syntax/types";
import { tokenizeKdl } from "./syntax/kdl";
import { tokenizeAsp } from "./syntax/asp";
import { tokenizeRazorVb } from "./syntax/razorVb";
import { tokenizePhpSql } from "./syntax/phpSql";
import { tokenizeJsSql } from "./syntax/jsSql";
import { tokenizeNginx } from "./syntax/nginx";
import { assemblePdf, CODE_PDF_FONTS } from "./pdfAssembler";
import { renderMarkdownToHtml } from "./markdownRenderer";
import { buildMarkdownPdfPages, MARKDOWN_PDF_FONTS } from "./markdownToPdf";

// ─── Token colour palette (mirrors syntaxHighlighting.ts TOKEN_STYLES) ────────
const TOKEN_COLORS: Record<string, string> = {
	comment: "#57A64A",
	string: "#D69D85",
	number: "#B5CEA8",
	boolean: "#569CD6",
	typeAnnotation: "#4EC9B0",
	nodeName: "#4FC1FF",
	propKey: "#9CDCFE",
	keyword: "#569CD6",
	vbType: "#4EC9B0",
	htmlTag: "#569CD6",
	htmlAttribute: "#FF8C69",
	htmlString: "#D69D85",
	aspDelimiter: "#DCDCAA",
	razorDelimiter: "#DCDCAA",
	razorDirective: "#CE9178",
	sqlKeyword: "#569CD6",
	sqlType: "#4EC9B0",
	sqlFunction: "#DCDCAA",
	sqlVariable: "#9CDCFE",
	nginxVariable: "#9CDCFE",
	nginxBlock: "#4EC9B0",
};
const TOKEN_BOLD = new Set([
	"nodeName",
	"aspDelimiter",
	"razorDelimiter",
	"nginxBlock",
]);
const TOKEN_ITALIC = new Set(["comment", "razorDirective"]);

// ─── File-extension → tokenizer map ──────────────────────────────────────────
const TOKENIZERS: Array<{
	extensions: string[];
	tokenize: (text: string) => TokenMatch[];
}> = [
	{ extensions: [".kdl"], tokenize: tokenizeKdl },
	{ extensions: [".asp"], tokenize: tokenizeAsp },
	{ extensions: [".vbhtml"], tokenize: tokenizeRazorVb },
	{ extensions: [".php"], tokenize: tokenizePhpSql },
	{
		extensions: [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"],
		tokenize: tokenizeJsSql,
	},
	{ extensions: [".conf"], tokenize: tokenizeNginx },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

interface StyledRun {
	text: string;
	color?: string;
	bold?: boolean;
	italic?: boolean;
}

// ─── Code PDF page builder ────────────────────────────────────────────────────

const PDF_MX = 45; // horizontal margin (pts)
const PDF_MY = 52; // vertical margin (pts)
const PDF_FS = 9; // font size (pts)
const PDF_LH = 13; // line height (pts)
const PDF_W = 595; // A4 width (used for rule length)
const PDF_H = 842; // A4 height (used for page start y)

const DEFAULT_TEXT_COLOR = "#1a1a1a"; // near-black on white paper
const LINE_NUM_COLOR = "#57606a"; // medium gray, readable on white

/** Convert a #rrggbb hex color to a PDF non-stroking (`rg`) operator string. */
function pdfColor(hex: string): string {
	const h = hex.startsWith("#") ? hex.slice(1) : hex;
	const r = parseInt(h.slice(0, 2), 16) / 255;
	const g = parseInt(h.slice(2, 4), 16) / 255;
	const b = parseInt(h.slice(4, 6), 16) / 255;
	return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

/** Escape a string for use inside a PDF string literal. Expands tabs to 4 spaces. */
function pdfEscape(text: string): string {
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

/** Return the PDF font resource name for the given style (Courier family). */
function pdfFont(bold?: boolean, italic?: boolean): string {
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

/**
 * Build the raw PDF content stream string for each page.
 *
 * Font map: F1=Courier  F2=Courier-Bold  F3=Courier-Oblique  F4=Courier-BoldOblique
 * All at PDF_FS pt; Courier char width = PDF_FS * 0.6 pts.
 *
 * Layout:
 *   First page  – filename + meta header, separator rule, code lines
 *   Other pages – code lines from top margin
 *   All pages   – footer rule + centred page number
 */
function buildPdfPageContents(
	lineRuns: StyledRun[][],
	fileName: string,
	languageId: string,
	date: string,
): string[] {
	const lineCount = lineRuns.length;
	const lnWidth = Math.max(String(lineCount).length, 1);

	const pages: string[] = [];
	const parts: string[] = [];
	let y = 0;
	let pageNum = 0;
	let firstLineOnPage = true;

	function startPage(isFirst: boolean): void {
		pageNum++;
		parts.length = 0;
		firstLineOnPage = true;
		y = PDF_H - PDF_MY;

		if (isFirst) {
			// ── File header ──
			parts.push(`BT\n/F2 11 Tf\n${PDF_MX} ${y} Td\n`);
			parts.push(`${pdfColor("#1f2328")} (${pdfEscape(fileName)}) Tj\n`);
			y -= 16;
			parts.push(`0 -16 Td\n`);
			const bullet = "\xB7"; // middle dot, WinAnsiEncoding byte 0xB7
			const meta = `${languageId}   ${bullet}   ${lineCount} line${lineCount !== 1 ? "s" : ""}   ${bullet}   ${date}`;
			parts.push(
				`/F1 8 Tf\n${pdfColor("#57606a")} (${pdfEscape(meta)}) Tj\n`,
			);
			parts.push(`ET\n`);
			// ── Separator rule ──
			y -= 8;
			const strokeColor = pdfColor("#d0d7de").replace(" rg", " RG");
			parts.push(
				`q\n${strokeColor}\n0.5 w\n${PDF_MX} ${y} m ${PDF_W - PDF_MX} ${y} l S\nQ\n`,
			);
			y -= PDF_LH + 4;
		}

		// Code section BT
		parts.push(`BT\n/F1 ${PDF_FS} Tf\n`);
	}

	function endPage(): void {
		parts.push(`ET\n`);
		// ── Footer rule ──
		const footerRuleY = PDF_MY - 14;
		const strokeColor = pdfColor("#d0d7de").replace(" rg", " RG");
		parts.push(
			`q\n${strokeColor}\n0.25 w\n${PDF_MX} ${footerRuleY + 10} m ${PDF_W - PDF_MX} ${footerRuleY + 10} l S\nQ\n`,
		);
		// ── Page number ──
		const pg = `Page ${pageNum}`;
		const pgX = ((PDF_W - pg.length * PDF_FS * 0.6) / 2).toFixed(1);
		parts.push(
			`BT\n/F1 8 Tf\n${pgX} ${footerRuleY} Td\n${pdfColor(LINE_NUM_COLOR)} (${pdfEscape(pg)}) Tj\nET\n`,
		);
		pages.push(parts.join(""));
	}

	startPage(true);

	for (let li = 0; li < lineRuns.length; li++) {
		if (y - PDF_LH < PDF_MY + 24) {
			endPage();
			startPage(false);
		}

		if (firstLineOnPage) {
			parts.push(`${PDF_MX} ${y} Td\n`);
			firstLineOnPage = false;
		} else {
			parts.push(`0 ${-PDF_LH} Td\n`);
		}
		y -= PDF_LH;

		// Line number in gray
		const lnStr = String(li + 1).padStart(lnWidth) + " | ";
		parts.push(
			`${pdfColor(LINE_NUM_COLOR)} /F1 ${PDF_FS} Tf (${pdfEscape(lnStr)}) Tj\n`,
		);

		// Syntax-highlighted code runs
		for (const run of lineRuns[li]) {
			const color = run.color ?? DEFAULT_TEXT_COLOR;
			const font = pdfFont(run.bold, run.italic);
			parts.push(
				`${pdfColor(color)} /${font} ${PDF_FS} Tf (${pdfEscape(run.text)}) Tj\n`,
			);
		}
	}

	endPage();
	return pages;
}

// ─── DOM serializer injected into the HTML webview ───────────────────────────
// Walks the *rendered* DOM (after CSS + JS have run) and converts it to the
// simplified block-level HTML that buildMarkdownPdfPages understands.
const SERIALIZER_SCRIPT = `<script>
(function () {
  const BLOCKS = new Set(["div","section","article","main","header","footer","nav","aside","blockquote","figure","details","fieldset","form","address","dialog"]);
  const INLINES = new Set(["span","label","abbr","cite","mark","small","sup","sub","time","bdi","bdo","q","var","samp","kbd","dfn","data"]);
  function esc(t) { return (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  // Join children, inserting a space between adjacent non-empty pieces that
  // don't already end/start with whitespace or a tag boundary.
  function kids(node, depth) {
    const parts = Array.from(node.childNodes).map(c => walk(c, depth)).filter(s => s !== "");
    let out = "";
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i > 0) {
        const prev = out;
        const needsSpace = prev && !prev.endsWith(" ") && !prev.endsWith("\\n") && !prev.endsWith(">")
                        && !p.startsWith(" ") && !p.startsWith("\\n") && !p.startsWith("<");
        if (needsSpace) out += " ";
      }
      out += p;
    }
    return out;
  }
  function walk(node, depth) {
    if (!node || depth > 30) return "";
    if (node.nodeType === 3) {
      const t = (node.textContent || "").replace(/\\s+/g, " ");
      return t.trim() ? t : (t === " " ? " " : "");
    }
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    if (["script","style","noscript","svg","canvas","iframe","input","select","textarea","button"].includes(tag)) return "";
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return "";
    const d = depth + 1;
    if (tag === "strong" || tag === "b")   return "<strong>" + kids(node,d) + "</strong>";
    if (tag === "em"     || tag === "i")   return "<em>"     + kids(node,d) + "</em>";
    if (tag === "del"    || tag === "s")   return "<del>"    + kids(node,d) + "</del>";
    if (tag === "a")   return "<a>" + kids(node,d) + "</a>";
    if (tag === "code") return "<code>" + esc(node.textContent || "") + "</code>";
    if (tag === "br")  return "\\n";
    if (tag === "hr")  return "<hr>\\n";
    if (tag === "img") return "";
    if (/^h[1-6]$/.test(tag)) {
      const t = (node.textContent || "").replace(/\\s+/g," ").trim();
      return t ? "<" + tag + ">" + esc(t) + "</" + tag + ">\\n" : "";
    }
    if (tag === "p") {
      const t = kids(node, d).trim();
      return t ? "<p>" + t + "</p>\\n" : "";
    }
    if (tag === "ul" || tag === "ol") {
      const startAttr = tag === "ol" ? (' start="' + (node.getAttribute("start") || "1") + '"') : "";
      let out = "<" + tag + startAttr + ">\\n";
      for (const li of node.children) {
        if (li.tagName.toLowerCase() === "li") {
          const c = kids(li, d).trim();
          if (c) out += "<li>" + c + "</li>\\n";
        }
      }
      return out + "</" + tag + ">\\n";
    }
    if (tag === "table") {
      let tbl = "<table>\\n";
      const thead = node.querySelector("thead");
      const tbody = node.querySelector("tbody") || node;
      if (thead) {
        tbl += "<thead><tr>";
        for (const th of thead.querySelectorAll("th")) tbl += "<th>" + esc((th.textContent||"").trim()) + "</th>";
        tbl += "</tr></thead>\\n";
      }
      tbl += "<tbody>\\n";
      for (const tr of tbody.querySelectorAll(":scope > tr")) {
        tbl += "<tr>";
        for (const td of tr.querySelectorAll("td, th")) tbl += "<td>" + esc((td.textContent||"").trim()) + "</td>";
        tbl += "</tr>\\n";
      }
      return tbl + "</tbody></table>\\n";
    }
    if (tag === "pre") {
      const ce = node.querySelector("code");
      return "<pre><code>" + esc((ce || node).textContent || "") + "</code></pre>\\n";
    }
    // Inline-only elements: treat as transparent and just emit their text content
    if (INLINES.has(tag)) {
      const t = kids(node, d);
      return t;
    }
    // Block containers: recurse and decide wrapping based on what came out
    if (BLOCKS.has(tag)) {
      const ic = kids(node, d).trim();
      if (!ic) return "";
      // If content has any block-level tags, return as-is (they self-contain)
      if (/<(h[1-6]|p|ul|ol|table|pre|hr)[ \\t\\n>]/.test(ic)) return ic + "\\n";
      // Pure inline content: wrap in a paragraph
      return "<p>" + ic + "</p>\\n";
    }
    return kids(node, d);
  }
  window.addEventListener("load", function () {
    setTimeout(function () {
      try {
        const api = acquireVsCodeApi();
        api.postMessage({ type: "serialized", html: walk(document.body, 0) });
      } catch (e) {
        try { acquireVsCodeApi().postMessage({ type: "error", message: String(e) }); } catch (_) {}
      }
    }, 1500);
  });
})();
</script>`;

/**
 * Loads an HTML file in a temporary webview, lets it fully render (CSS + JS),
 * then serializes the visible DOM back to simplified block-level HTML for the
 * PDF pipeline.  The panel is disposed as soon as the message arrives.
 */
function renderHtmlViaWebview(htmlContent: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const panel = vscode.window.createWebviewPanel(
			"theToyBox.htmlRenderer",
			"The Toy Box: Preparing PDF\u2026",
			{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
			{ enableScripts: true },
		);

		// Strip any Content-Security-Policy meta tags from the source HTML so they
		// don't block our injected serializer script from running in the webview.
		const sanitized = htmlContent.replace(
			/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
			"",
		);

		// Inject the serializer before </body>, or append it if no </body>.
		const injected = /\<\/body\>/i.test(sanitized)
			? sanitized.replace(/<\/body>/i, SERIALIZER_SCRIPT + "\n</body>")
			: sanitized + "\n" + SERIALIZER_SCRIPT;

		const timer = setTimeout(() => {
			panel.dispose();
			reject(new Error("HTML rendering timed out"));
		}, 10_000);

		panel.webview.onDidReceiveMessage(
			(msg: { type: string; html?: string; message?: string }) => {
				clearTimeout(timer);
				panel.dispose();
				if (msg.type === "serialized" && msg.html != null) {
					resolve(msg.html);
				} else {
					reject(
						new Error(msg.message ?? "DOM serialization failed"),
					);
				}
			},
		);

		panel.webview.html = injected;
	});
}

/** Tokenize the document, generate the PDF, and prompt the user for a save location. */
async function generateAndSavePdf(
	fileName: string,
	languageId: string,
	content: string,
	context?: vscode.ExtensionContext,
): Promise<void> {
	const date = new Date().toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	let pageContents: string[];
	let fontSet: typeof CODE_PDF_FONTS;

	if (languageId === "markdown") {
		// Render markdown → HTML → PDF pages using Helvetica fonts
		const html = renderMarkdownToHtml(content);
		pageContents = buildMarkdownPdfPages(html, fileName, date);
		fontSet = MARKDOWN_PDF_FONTS;
	} else if (languageId === "html") {
		// Render via webview so CSS + JS produce the real DOM, then serialize it.
		let htmlBody: string;
		try {
			htmlBody = await renderHtmlViaWebview(content);
		} catch {
			// Timeout or error — fall back to static regex extraction
			htmlBody = content;
		}
		pageContents = buildMarkdownPdfPages(htmlBody, fileName, date, "HTML");
		fontSet = MARKDOWN_PDF_FONTS;
	} else {
		// Render source code → syntax-highlighted PDF pages using Courier fonts
		const ext = path.extname(fileName).toLowerCase();
		const profile = TOKENIZERS.find((p) => p.extensions.includes(ext));
		const lineRuns = profile
			? runsToLines(buildStyledRuns(content, profile.tokenize(content)))
			: content
					.split("\n")
					.map((line): StyledRun[] =>
						line.length > 0 ? [{ text: line }] : [],
					);
		pageContents = buildPdfPageContents(
			lineRuns,
			fileName,
			languageId,
			date,
		);
		fontSet = CODE_PDF_FONTS;
	}

	const pdfBuffer = assemblePdf(pageContents, fileName, fontSet);

	const activeFile = vscode.window.activeTextEditor?.document.fileName;
	const defaultUri = activeFile
		? vscode.Uri.file(
				path.join(
					path.dirname(activeFile),
					fileName.replace(/\.[^.]+$/, "") + ".pdf",
				),
			)
		: undefined;

	const saveUri = await vscode.window.showSaveDialog({
		defaultUri,
		filters: { "PDF Files": ["pdf"] },
		title: "Save as PDF",
	});
	if (!saveUri) {
		return;
	}

	await vscode.workspace.fs.writeFile(saveUri, pdfBuffer);
	await vscode.env.openExternal(saveUri);
}

/** Converts source text + token list into styled run objects. */
function buildStyledRuns(text: string, tokens: TokenMatch[]): StyledRun[] {
	const sorted = [...tokens].sort((a, b) => a.start - b.start);
	const runs: StyledRun[] = [];
	let pos = 0;

	for (const token of sorted) {
		if (pos < token.start) {
			runs.push({ text: text.slice(pos, token.start) });
		}
		runs.push({
			text: text.slice(token.start, token.end),
			color: TOKEN_COLORS[token.type],
			bold: TOKEN_BOLD.has(token.type) || undefined,
			italic: TOKEN_ITALIC.has(token.type) || undefined,
		});
		pos = token.end;
	}

	if (pos < text.length) {
		runs.push({ text: text.slice(pos) });
	}

	return runs;
}

/** Splits an array of styled runs into per-line arrays, respecting multi-line tokens. */
function runsToLines(runs: StyledRun[]): StyledRun[][] {
	const lines: StyledRun[][] = [[]];

	for (const run of runs) {
		const parts = run.text.split("\n");
		for (let i = 0; i < parts.length; i++) {
			if (i > 0) {
				lines.push([]);
			}
			if (parts[i].length > 0) {
				lines[lines.length - 1].push({ ...run, text: parts[i] });
			}
		}
	}

	return lines;
}

function renderRun(run: StyledRun): string {
	const escaped = escapeHtml(run.text);
	const styleParts: string[] = [];
	if (run.color) {
		styleParts.push(`color:${run.color}`);
	}
	if (run.bold) {
		styleParts.push("font-weight:bold");
	}
	if (run.italic) {
		styleParts.push("font-style:italic");
	}
	if (styleParts.length === 0) {
		return escaped;
	}
	return `<span style="${styleParts.join(";")}">${escaped}</span>`;
}

// ─── Webview HTML builder ─────────────────────────────────────────────────────

function buildPrintWebviewHtml(
	fileName: string,
	languageId: string,
	content: string,
): string {
	const nonce = randomBytes(16).toString("base64");
	const ext = path.extname(fileName).toLowerCase();
	const profile = TOKENIZERS.find((p) => p.extensions.includes(ext));

	// Build per-line HTML
	let lineHtmlArray: string[];
	if (profile) {
		const tokens = profile.tokenize(content);
		const runs = buildStyledRuns(content, tokens);
		const lineRuns = runsToLines(runs);
		lineHtmlArray = lineRuns.map((lr) => lr.map(renderRun).join(""));
	} else {
		lineHtmlArray = content.split("\n").map(escapeHtml);
	}

	const lineCount = lineHtmlArray.length;
	const lineNumWidth = String(lineCount).length;

	const numberedLines = lineHtmlArray
		.map((lineHtml, i) => {
			const lineNum = String(i + 1).padStart(lineNumWidth, " ");
			return `<div class="line"><span class="ln">${escapeHtml(lineNum)}</span><span class="lc">${lineHtml}</span></div>`;
		})
		.join("");

	const date = new Date().toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; object-src 'none'; frame-ancestors 'none';">
<title>${escapeHtml(fileName)}</title>
<style nonce="${nonce}">
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12px;
    background: #1e1e1e;
    color: #d4d4d4;
  }
  .toolbar {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #252526;
    border-bottom: 1px solid #3e3e42;
    z-index: 100;
  }
  .toolbar-left { display: flex; flex-direction: column; }
  .file-name { font-weight: bold; font-size: 13px; color: #e1e4e8; }
  .file-meta { font-size: 11px; color: #858585; margin-top: 2px; }
  .print-btn {
    background: #0e639c;
    color: #fff;
    border: none;
    padding: 6px 16px;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .print-btn:hover { background: #1177bb; }
  .code-container { padding: 12px 0; overflow: auto; }
  .line {
    display: flex;
    line-height: 1.5;
    min-height: 1.5em;
    padding: 0 16px 0 0;
  }
  .line:hover { background: rgba(255,255,255,0.04); }
  .ln {
    flex-shrink: 0;
    color: #858585;
    border-right: 1px solid #3e3e42;
    padding-right: 12px;
    margin-right: 16px;
    min-width: ${lineNumWidth + 2}ch;
    text-align: right;
    user-select: none;
    -webkit-user-select: none;
  }
  .lc { flex: 1; white-space: pre; }
  @media print {
    @page { margin: 1.5cm; size: A4; }
    body { background: #1e1e1e; color: #d4d4d4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { display: none; }
    .code-container { padding: 0; }
    .line:hover { background: none; }
    .ln { color: #858585; border-color: #3e3e42; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <div class="toolbar-left">
    <span class="file-name">${escapeHtml(fileName)}</span>
    <span class="file-meta">${escapeHtml(languageId)} &bull; ${lineCount} lines &bull; ${escapeHtml(date)}</span>
  </div>
  <button class="print-btn" id="printBtn">Save as PDF</button>
</div>
<div class="code-container">${numberedLines}</div>
<script nonce="${nonce}">
  document.getElementById('printBtn').addEventListener('click', function () {
    const vscode = acquireVsCodeApi();
    vscode.postMessage({ command: 'print' });
  });
</script>
</body>
</html>`;
}

// ─── Panel management ─────────────────────────────────────────────────────────

let currentPanel: vscode.WebviewPanel | undefined;
/** Holds the most-recently-opened document data so the message handler is stateless. */
let currentPrintData:
	| { fileName: string; languageId: string; content: string }
	| undefined;

async function openPrintPanel(
	context: vscode.ExtensionContext,
	uri?: vscode.Uri,
): Promise<void> {
	const enabled = vscode.workspace
		.getConfiguration("theToyBox.print")
		.get<boolean>("enabled", true);
	if (!enabled) {
		vscode.window.showInformationMessage(
			'The Toy Box: Printing is disabled. Enable it in Settings under "Toy Box › Print: Enabled".',
		);
		return;
	}

	let document: vscode.TextDocument | undefined;

	if (uri) {
		try {
			document = await vscode.workspace.openTextDocument(uri);
		} catch {
			vscode.window.showWarningMessage(
				"The Toy Box: Could not open file for printing.",
			);
			return;
		}
	} else {
		document = vscode.window.activeTextEditor?.document;
	}

	if (!document) {
		vscode.window.showWarningMessage("The Toy Box: No file to print.");
		return;
	}

	const fileName = document.fileName
		? path.basename(document.fileName)
		: "Untitled";
	const languageId = document.languageId;
	const content = document.getText();

	// Always refresh the data used by the panel's message handler.
	currentPrintData = { fileName, languageId, content };

	const html = buildPrintWebviewHtml(fileName, languageId, content);

	if (currentPanel) {
		currentPanel.title = `Print: ${fileName}`;
		currentPanel.webview.html = html;
		currentPanel.reveal(vscode.ViewColumn.Beside);
		return;
	}

	currentPanel = vscode.window.createWebviewPanel(
		"toyboxPrint",
		`Print: ${fileName}`,
		vscode.ViewColumn.Beside,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
		},
	);

	currentPanel.webview.html = html;

	// Register the message handler exactly ONCE per panel lifetime.
	// It reads currentPrintData which is kept up-to-date on every invocation.
	currentPanel.webview.onDidReceiveMessage((msg) => {
		if (msg.command !== "print" || !currentPrintData) {
			return;
		}
		void generateAndSavePdf(
			currentPrintData.fileName,
			currentPrintData.languageId,
			currentPrintData.content,
			context,
		);
	});

	currentPanel.onDidDispose(() => {
		currentPanel = undefined;
		currentPrintData = undefined;
	});
}

export function registerPrintCommand(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"theToyBox.printFile",
			(uri?: vscode.Uri) => openPrintPanel(context, uri),
		),
	);

	// Direct save-as-PDF command — used by the editor toolbar icon.
	// Skips the webview preview panel and goes straight to the save dialog.
	context.subscriptions.push(
		vscode.commands.registerCommand("theToyBox.savePdf", async () => {
			const enabled = vscode.workspace
				.getConfiguration("theToyBox.print")
				.get<boolean>("enabled", true);
			if (!enabled) {
				vscode.window.showInformationMessage(
					'The Toy Box: Printing is disabled. Enable it in Settings under "Toy Box › Print: Enabled".',
				);
				return;
			}

			const document = vscode.window.activeTextEditor?.document;
			if (!document) {
				vscode.window.showWarningMessage(
					"The Toy Box: No file to save as PDF.",
				);
				return;
			}

			const fileName = document.fileName
				? path.basename(document.fileName)
				: "Untitled";

			await generateAndSavePdf(
				fileName,
				document.languageId,
				document.getText(),
				context,
			);
		}),
	);
}
