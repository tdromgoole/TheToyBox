import * as vscode from "vscode";
import * as path from "path";
import { randomBytes } from "crypto";
import { assemblePdf, CODE_PDF_FONTS, PdfImage } from "./pdfAssembler";
import { renderMarkdownToHtml } from "./markdownRenderer";
import { prepareShikiCodeHighlighter } from "./shikiHighlighter";
import {
	buildMarkdownPdfPages,
	MARKDOWN_PDF_FONTS,
} from "./markdownToPdf";
import {
	StyledRun,
	CODE_TOKENIZERS as TOKENIZERS,
	buildStyledRuns,
	runsToLines,
} from "./codeTokenizer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
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

  // SVG → JPEG conversion map (populated before walk is called)
  const svgImages = new Map();

  async function svgToJpeg(svgEl) {
    try {
      let w = parseFloat(svgEl.getAttribute("width") || "0") || 0;
      let h = parseFloat(svgEl.getAttribute("height") || "0") || 0;
      if (!w || !h) {
        const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
        if (vb && vb.width) { w = vb.width; h = vb.height; }
      }
      if (!w || !h) {
        const r = svgEl.getBoundingClientRect();
        w = r.width; h = r.height;
      }
      if (!w || !h || w < 10 || h < 10) return null;
      // Render at higher resolution for PDF quality
      const scale = Math.max(1.5, 1000 / w);
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const dataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
      return new Promise(function(resolve) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement("canvas");
          canvas.width = cw; canvas.height = ch;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          resolve({ jpeg: canvas.toDataURL("image/jpeg", 0.9), w: cw, h: ch });
        };
        img.onerror = function() { resolve(null); };
        img.src = dataUrl;
      });
    } catch(e) { return null; }
  }

  function walk(node, depth) {
    if (!node || depth > 30) return "";
    if (node.nodeType === 3) {
      const t = (node.textContent || "").replace(/\\s+/g, " ");
      return t.trim() ? t : (t === " " ? " " : "");
    }
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    if (["script","style","noscript","canvas","iframe","input","select","textarea","button"].includes(tag)) return "";
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return "";
    const d = depth + 1;
    if (tag === "svg") {
      const imgData = svgImages.get(node);
      if (imgData) return \`<img src="\${imgData.jpeg}" width="\${imgData.w}" height="\${imgData.h}">\\n\`;
      return "";
    }
    // Preserve Toy Box alert semantics across the Mermaid DOM round-trip.
    // Generic div serialization intentionally drops classes, which previously
    // reduced alerts to ordinary paragraphs and leaked icon ligature names.
    if (tag === "div" && node.classList.contains("markdown-alert")) {
      const types = ["note", "tip", "important", "warning", "caution"];
      const type = types.find(t => node.classList.contains(t)) || "note";
      const icons = { note: "info", tip: "lightbulb", important: "priority_high", warning: "warning", caution: "cancel" };
      const titleEl = node.querySelector(":scope > .alert-title");
      let title = "";
      if (titleEl) {
        title = Array.from(titleEl.childNodes)
          .filter(c => !(c.nodeType === 1 && c.classList && c.classList.contains("alert-icon")))
          .map(c => walk(c, d))
          .join("")
          .trim();
      }
      let body = "";
      for (const child of node.children) {
        if (child !== titleEl) body += walk(child, d);
      }
      return '<div class="markdown-alert ' + type + '">\\n' +
        '<p class="alert-title"><span class="alert-icon">' + icons[type] + '</span> ' + title + '</p>\\n' +
        body + '</div>\\n';
    }
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
    if (tag === "ul" && node.classList.contains("task-list")) {
      let out = '<ul class="task-list">\\n';
      for (const li of node.children) {
        if (li.tagName.toLowerCase() !== "li") continue;
        const box = li.querySelector(":scope > .task-box");
        const checked = Boolean(box && box.classList.contains("task-checked"));
        const content = Array.from(li.childNodes)
          .filter(child => child !== box)
          .map(child => walk(child, d))
          .join("")
          .trim();
        out += '<li class="task-item"><span class="task-box' +
          (checked ? ' task-checked' : '') + '">' +
          (checked ? '&#x2713;' : '') + '</span> ' + content + '</li>\\n';
      }
      return out + "</ul>\\n";
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
      const languageClass = ce
        ? Array.from(ce.classList).find(c => /^language-[A-Za-z0-9_+-]+$/.test(c))
        : undefined;
      const classAttr = languageClass ? ' class="' + languageClass + '"' : "";
      return "<pre><code" + classAttr + ">" + esc((ce || node).textContent || "") + "</code></pre>\\n";
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
      if (/<(h[1-6]|p|ul|ol|table|pre|hr|img)[ \\t\\n>\\/]/.test(ic)) return ic + "\\n";
      // Pure inline content: wrap in a paragraph
      return "<p>" + ic + "</p>\\n";
    }
    return kids(node, d);
  }
  window.addEventListener("load", function () {
    setTimeout(async function () {
      try {
        const api = globalThis.__toyboxVscodeApi || acquireVsCodeApi();
        // Pre-render all SVG elements to JPEG before DOM serialization
        for (const svgEl of document.querySelectorAll("svg")) {
          const result = await svgToJpeg(svgEl);
          if (result) svgImages.set(svgEl, result);
        }
        // The progress overlay is UI-only and must not enter the PDF DOM.
        document.getElementById("toybox-preparing-overlay")?.remove();
        api.postMessage({ type: "serialized", html: walk(document.body, 0) });
      } catch (e) {
        try { (globalThis.__toyboxVscodeApi || acquireVsCodeApi()).postMessage({ type: "error", message: String(e) }); } catch (_) {}
      }
    }, 2500);
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

/**
 * Renders a pre-built Mermaid HTML page in a temporary webview.
 * The HTML already has a nonce-based CSP and serializer — it is NOT sanitized.
 */
function renderMermaidViaWebview(
	markdownHtml: string,
	context: vscode.ExtensionContext,
): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const mermaidRoot = vscode.Uri.joinPath(context.extensionUri, "dist", "assets");
		const panel = vscode.window.createWebviewPanel(
			"theToyBox.mermaidRenderer",
			"The Toy Box: Preparing PDF\u2026",
			{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
			{ enableScripts: true, localResourceRoots: [mermaidRoot] },
		);
		const mermaidScriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mermaidRoot, "mermaid.min.js"));
		const pageHtml = buildMermaidPage(markdownHtml, mermaidScriptUri.toString(), panel.webview.cspSource);

		const timer = setTimeout(() => {
			panel.dispose();
			reject(new Error("Mermaid rendering timed out"));
		}, 15_000);

		panel.webview.onDidReceiveMessage(
			(msg: { type: string; html?: string; message?: string }) => {
				clearTimeout(timer);
				panel.dispose();
				if (msg.type === "serialized" && msg.html != null) {
					resolve(msg.html);
				} else {
					reject(
						new Error(
							msg.message ?? "Mermaid serialization failed",
						),
					);
				}
			},
		);

		panel.webview.html = pageHtml;
	});
}

/**
 * Builds a standalone HTML page that loads Mermaid.js to render
 * diagrams.  Fenced-mermaid code blocks are converted to Mermaid divs, and
 * the DOM serializer script is embedded.  A per-call nonce keeps script-src
 * free of unsafe inline script (nonce is attached to each <script> tag).
 */
function buildMermaidPage(
	markdownHtml: string,
	mermaidScriptUri: string,
	webviewCspSource: string,
): string {
	const nonce = randomBytes(16).toString("hex");

	// Replace <pre><code class="language-mermaid">…</code></pre> with
	// <div class="mermaid">…</div>, unescaping HTML entities.
	const withMermaid = markdownHtml.replace(
		/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi,
		(_, src: string) => {
			const decoded = src
				.replace(/&amp;/g, "&")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/&quot;/g, '"');
			// Quote participant/actor alias labels that contain chars Mermaid
			// cannot accept in an unquoted label (e.g. / < > ( ) { }).
			const fixed = decoded.replace(
				/^(\s*(?:participant|actor)\s+\S+\s+as\s+)(?!")(.*\S)/gm,
				(m, prefix: string, label: string) =>
					/[/<>(){}]/.test(label) ? `${prefix}"${label}"` : m,
			);
			return `<div class="mermaid">${fixed}</div>`;
		},
	);

	// Use the packaged script so webview loading does not depend on network access.
	const csp = [
		"default-src 'none'",
		`script-src ${webviewCspSource} 'nonce-${nonce}'`,
		"style-src 'unsafe-inline'", // Mermaid injects inline styles at runtime — unavoidable
		"img-src data: blob:",
		"object-src 'none'",
		"frame-ancestors 'none'",
	].join("; ");

	// Tag the serializer's <script> element with the nonce so it passes the CSP
	const serializer = SERIALIZER_SCRIPT.replace(
		"<script>",
		`<script nonce="${nonce}">`,
	);

	return [
		"<!DOCTYPE html>",
		"<html>",
		"<head>",
		'<meta charset="UTF-8">',
		`<meta http-equiv="Content-Security-Policy" content="${csp}">`,
		"<style>",
		"  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
		"         background: #fff; color: #1a1a1a; padding: 20px; max-width: 900px; margin: 0 auto; }",
		"  .mermaid { background: #fff; text-align: center; margin: 1em 0; }",
		"  #toybox-preparing-overlay { position: fixed; inset: 0; z-index: 2147483647;",
		"    display: flex; align-items: center; justify-content: center;",
		"    background: rgba(0, 0, 0, 0.58); backdrop-filter: blur(1px); }",
		"  .toybox-preparing-card { display: flex; align-items: center; gap: 14px;",
		"    padding: 18px 22px; border-radius: 8px; color: #f3f3f3; background: #252526;",
		"    box-shadow: 0 8px 28px rgba(0,0,0,.45); font-size: 14px; font-weight: 600; }",
		"  .toybox-spinner { width: 24px; height: 24px; box-sizing: border-box;",
		"    border: 3px solid rgba(255,255,255,.25); border-top-color: #75beff;",
		"    border-radius: 50%; animation: toybox-spin .8s linear infinite; }",
		"  @keyframes toybox-spin { to { transform: rotate(360deg); } }",
		"</style>",
		"</head>",
		"<body>",
		withMermaid,
		'<div id="toybox-preparing-overlay" role="status" aria-live="polite">' +
			'<div class="toybox-preparing-card"><div class="toybox-spinner"></div>' +
			'<span>Preparing PDF…</span></div></div>',
		`<script nonce="${nonce}">
			globalThis.__toyboxVscodeApi = acquireVsCodeApi();
			window.addEventListener("error", event => globalThis.__toyboxVscodeApi.postMessage({ type: "error", message: "webview error: " + event.message }));
		</script>`,
		`<script nonce="${nonce}" src="${mermaidScriptUri}"></script>`,
		`<script nonce="${nonce}">
			mermaid.initialize({ startOnLoad: true, theme: "default", securityLevel: "loose" });
		</script>`,
		serializer,
		"</body>",
		"</html>",
	].join("\n");
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
	const imageCollector: PdfImage[] = [];

	if (languageId === "markdown") {
		// Render markdown → HTML → PDF pages using Helvetica fonts
		const html = renderMarkdownToHtml(content);
		const fencedLanguages = [...content.matchAll(/^```([^\s`]*)/gm)]
			.map((match) => match[1])
			.filter(Boolean);
		let codeHighlighter: Awaited<ReturnType<typeof prepareShikiCodeHighlighter>> | undefined;
		try {
			codeHighlighter = await prepareShikiCodeHighlighter(fencedLanguages);
		} catch {
			// Fall back to the built-in tokenizers below.
		}
		if (/<pre><code class="language-mermaid"/.test(html)) {
			// Mermaid diagrams detected — render via webview so they produce SVG,
			// then the serializer rasterises each SVG to JPEG for embedding.
			let rendered = html;
			try {
				if (!context) {
					throw new Error("Extension context is unavailable for Mermaid rendering");
				}
				rendered = await renderMermaidViaWebview(html, context);
			} catch {
				// timeout or CSP block — fall back to showing source text
			}
			pageContents = buildMarkdownPdfPages(
				rendered,
				fileName,
				date,
				"Markdown",
				imageCollector,
				codeHighlighter,
			);
		} else {
			pageContents = buildMarkdownPdfPages(html, fileName, date, "Markdown", undefined, codeHighlighter);
		}
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
		pageContents = buildMarkdownPdfPages(
			htmlBody,
			fileName,
			date,
			"HTML",
			imageCollector,
		);
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

	const pdfBuffer = assemblePdf(
		pageContents,
		fileName,
		fontSet,
		imageCollector,
	);

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
			async (uri?: vscode.Uri) => {
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
			},
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
