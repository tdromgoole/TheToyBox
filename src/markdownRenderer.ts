/**
 * markdownRenderer.ts
 *
 * Shared markdown → HTML renderer used by both the webview preview panel
 * (markdownPreview.ts) and the PDF printer (markdownToPdf.ts).
 *
 * Supports:
 *   • Headings h1–h6
 *   • Bold / italic / strikethrough / inline code
 *   • Fenced code blocks
 *   • Unordered and ordered lists
 *   • Task lists  [ ] / [x]
 *   • Tables
 *   • Horizontal rules
 *   • Images and links
 *   • GitHub-style alerts  > [!NOTE] etc.
 */

// ─── Alert formatting ─────────────────────────────────────────────────────────

interface AlertInfo {
	name: string; // Material Symbol icon name (for webview)
	unicode: string; // fallback character
	title: string;
}

const ALERT_DATA: Record<string, AlertInfo> = {
	note: { name: "info", unicode: "ℹ", title: "Note" },
	tip: { name: "lightbulb", unicode: "💡", title: "Tip" },
	important: { name: "priority_high", unicode: "❗", title: "Important" },
	warning: { name: "warning", unicode: "⚠", title: "Warning" },
	caution: { name: "cancel", unicode: "🛑", title: "Caution" },
};

function escHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function formatAlert(type: string, content: string, customTitle = ""): string {
	const info = ALERT_DATA[type] ?? ALERT_DATA.note;
	const displayTitle = customTitle || info.title;
	const safeTitle = escHtml(displayTitle);
	return (
		`<div class="markdown-alert ${type}">\n` +
		`<p class="alert-title"><span class="alert-icon">${info.name}</span> ${safeTitle}</p>\n` +
		`<p>${content}</p>\n` +
		`</div>`
	);
}

// ─── List builder ─────────────────────────────────────────────────────────────

function buildList(markdown: string, ordered: boolean): string {
	const itemRe = ordered
		? /^([ \t]*)\d+\. (.*)$/gm
		: /^([ \t]*)[-*+] (.*)$/gm;
	const tag = ordered ? "ol" : "ul";

	return markdown.replace(
		ordered
			? /((?:^[ \t]*\d+\. .*\n?)+)/gm
			: /((?:^[ \t]*[-*+] (?!\[[ x]\]).*\n?)+)/gm,
		(block) => {
			const items = block
				.trimEnd()
				.split("\n")
				.filter(Boolean)
				.map((line) =>
					line.replace(
						itemRe,
						(_m: string, _indent: string, text: string) =>
							`<li>${text}</li>`,
					),
				)
				.join("");
			return `<${tag}>${items}</${tag}>`;
		},
	);
}

// ─── Core renderer ────────────────────────────────────────────────────────────

/**
 * Convert raw markdown text (including GitHub-style alerts) to an HTML
 * fragment suitable for embedding in a document body.
 *
 * Returns only the inner body content — no `<html>` / `<head>` wrapper.
 */
export function renderMarkdownToHtml(markdown: string): string {
	// Normalize line endings so all regexes below can assume LF only
	markdown = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

	// ── Pass 1: extract GitHub-style alerts ──────────────────────────────────
	const lines = markdown.split("\n");
	let result = "";
	let inBlockquote = false;
	let blockquoteContent = "";
	let alertType = "";
	let alertCustomTitle = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (trimmed.startsWith("> [!") || trimmed.startsWith(">[!")) {
			const match = trimmed.match(
				/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\[([^\]]*)\])?/i,
			);
			if (match) {
				alertType = match[1].toLowerCase();
				alertCustomTitle = match[2]?.trim() ?? "";
				inBlockquote = true;
				blockquoteContent = "";
				continue;
			}
		}

		if (inBlockquote) {
			if (trimmed.startsWith(">")) {
				blockquoteContent += line.replace(/^>\s*/, "") + "\n";
			} else if (trimmed === "") {
				if (
					i + 1 < lines.length &&
					lines[i + 1].trim().startsWith(">")
				) {
					blockquoteContent += "\n";
				} else {
					inBlockquote = false;
					result +=
						formatAlert(
							alertType,
							blockquoteContent.trim(),
							alertCustomTitle,
						) + "\n\n";
					alertType = "";
					alertCustomTitle = "";
					blockquoteContent = "";
				}
			} else {
				inBlockquote = false;
				result +=
					formatAlert(
						alertType,
						blockquoteContent.trim(),
						alertCustomTitle,
					) + "\n\n";
				result += line + "\n";
				alertType = "";
				alertCustomTitle = "";
				blockquoteContent = "";
			}
		} else {
			result += line + "\n";
		}
	}

	if (inBlockquote) {
		result += formatAlert(
			alertType,
			blockquoteContent.trim(),
			alertCustomTitle,
		);
	}

	// ── Pass 2: standard Markdown transforms ─────────────────────────────────
	markdown = result;

	// Protect fenced code blocks
	const codeBlocks: string[] = [];
	markdown = markdown.replace(
		/```([\w]*)\n?([\s\S]*?)```/g,
		(_m, lang, body) => {
			codeBlocks.push(
				`<pre><code${lang ? ` class="language-${escHtml(lang)}"` : ""}>${escHtml(body.replace(/\n$/, ""))}</code></pre>`,
			);
			return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
		},
	);

	// Protect inline code
	const inlineCodes: string[] = [];
	markdown = markdown.replace(/`([^`]+)`/g, (_m, code) => {
		inlineCodes.push(`<code>${escHtml(code)}</code>`);
		return `%%INLINECODE_${inlineCodes.length - 1}%%`;
	});

	// Horizontal rules
	markdown = markdown.replace(/^(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "<hr>");

	// Headings h1–h6
	markdown = markdown.replace(/^###### (.*)$/gm, "<h6>$1</h6>");
	markdown = markdown.replace(/^##### (.*)$/gm, "<h5>$1</h5>");
	markdown = markdown.replace(/^#### (.*)$/gm, "<h4>$1</h4>");
	markdown = markdown.replace(/^### (.*)$/gm, "<h3>$1</h3>");
	markdown = markdown.replace(/^## (.*)$/gm, "<h2>$1</h2>");
	markdown = markdown.replace(/^# (.*)$/gm, "<h1>$1</h1>");

	// Tables
	markdown = markdown.replace(
		/^(\|.+\|)\n^(\|[-| :]+\|)\n((?:^\|.+\|\n?)+)/gm,
		(_match, header, _sep, body) => {
			const headers = header
				.replace(/^\|/, "")
				.replace(/\|$/, "")
				.split("|")
				.map((h: string) => `<th>${h.trim()}</th>`)
				.join("");
			const rows = body
				.trim()
				.split("\n")
				.map((row: string) => {
					const cells = row
						.replace(/^\|/, "")
						.replace(/\|$/, "")
						.split("|")
						.map((c: string) => `<td>${c.trim()}</td>`)
						.join("");
					return `<tr>${cells}</tr>`;
				})
				.join("");
			return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
		},
	);

	// Task lists (before unordered lists)
	markdown = markdown.replace(
		/^([ \t]*)(?:- )?\[x\] (.*)$/gim,
		(_m, _i, text) =>
			`<li class="task-item"><span class="task-box task-checked">&#x2713;</span> ${text}</li>`,
	);
	markdown = markdown.replace(
		/^([ \t]*)(?:- )?\[ \] (.*)$/gm,
		(_m, _i, text) =>
			`<li class="task-item"><span class="task-box"></span> ${text}</li>`,
	);
	markdown = markdown.replace(
		/(<\/li>)\n\n(<li class="task-item">)/g,
		"$1\n$2",
	);
	markdown = markdown.replace(
		/((?:^<li class="task-item">.*\n?)+)/gm,
		(block) => `<ul class="task-list">${block.trimEnd()}</ul>`,
	);

	// Lists
	markdown = buildList(markdown, false);
	markdown = buildList(markdown, true);

	// Images (before links)
	markdown = markdown.replace(
		/!\[([^\]]*)\]\(([^)]+)\)/g,
		'<img src="$2" alt="$1">',
	);

	// Links
	markdown = markdown.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2">$1</a>',
	);

	// Inline styles
	markdown = markdown.replace(
		/\*\*\*([^*]+)\*\*\*/g,
		"<strong><em>$1</em></strong>",
	);
	markdown = markdown.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	markdown = markdown.replace(/\*([^*]+)\*/g, "<em>$1</em>");
	markdown = markdown.replace(/~~([^~]+)~~/g, "<del>$1</del>");

	// Restore inline code
	markdown = markdown.replace(
		/%%INLINECODE_(\d+)%%/g,
		(_m, i) => inlineCodes[Number(i)],
	);

	// Paragraphs — code block placeholders must be restored AFTER this step so
	// blank lines inside fenced blocks don't get split into separate paragraphs.
	markdown = markdown
		.split(/\n{2,}/)
		.map((para) => {
			para = para.trim();
			if (!para) {
				return "";
			}
			if (
				para.match(
					/^(?:<(?:h[1-6]|p|pre|div|ul|ol|li|table|thead|tbody|tr|th|td|hr|img|blockquote)|%%CODEBLOCK)/i,
				)
			) {
				return para;
			}
			return `<p>${para.replace(/\n/g, " ")}</p>`;
		})
		.filter(Boolean)
		.join("\n");

	// Restore code blocks
	markdown = markdown.replace(
		/%%CODEBLOCK_(\d+)%%/g,
		(_m, i) => codeBlocks[Number(i)],
	);

	return markdown;
}
