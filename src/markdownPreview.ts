import * as vscode from "vscode";

// Plugs into VS Code's built-in markdown preview via the extendMarkdownIt API
export function extendMarkdownItWithAlerts(md: any): any {
	const alertData: Record<string, { icon: string; title: string }> = {
		note: { icon: "info", title: "Note" },
		tip: { icon: "lightbulb", title: "Tip" },
		important: { icon: "priority_high", title: "Important" },
		warning: { icon: "warning", title: "Warning" },
		caution: { icon: "cancel", title: "Caution" },
	};

	md.core.ruler.push("github_alerts", (state: any) => {
		const isEnabled = vscode.workspace
			.getConfiguration("theToyBox.markdownPreview")
			.get<boolean>("enabled", true);
		if (!isEnabled) {
			return;
		}

		const tokens = state.tokens;

		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type !== "blockquote_open") continue;

			let closeIdx = i + 1;
			while (
				closeIdx < tokens.length &&
				tokens[closeIdx].type !== "blockquote_close"
			) {
				closeIdx++;
			}

			let firstInlineIdx = -1;
			for (let k = i + 1; k < closeIdx; k++) {
				if (tokens[k].type === "inline") {
					firstInlineIdx = k;
					break;
				}
			}
			if (firstInlineIdx === -1) continue;

			const firstContent = tokens[firstInlineIdx].content;
			const match = firstContent.match(
				/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\[([^\]]*)\])?[ \t]*/i,
			);
			if (!match) continue;

			const type = match[1].toLowerCase();
			const info = alertData[type];
			const displayTitle = match[2]?.trim() || info.title;

			const contentParts: string[] = [];
			const firstRemainder = firstContent.slice(match[0].length).trim();
			if (firstRemainder) contentParts.push(firstRemainder);
			for (let k = firstInlineIdx + 1; k < closeIdx; k++) {
				if (tokens[k].type === "inline" && tokens[k].content.trim()) {
					contentParts.push(tokens[k].content.trim());
				}
			}

			const rendered = md.renderInline(contentParts.join(" "));
			const safeTitle = displayTitle
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;");
			const html =
				`<div class="markdown-alert ${type}">` +
				`<p class="alert-title"><span class="alert-icon">${info.icon}</span> ${safeTitle}</p>` +
				`<p>${rendered}</p>` +
				`</div>\n`;

			const token = new state.Token("html_block", "", 0);
			token.content = html;
			tokens.splice(i, closeIdx - i + 1, token);
		}
	});

	// Replace [ ] and [x] at the start of list item text with styled checkbox spans
	md.core.ruler.push("task_list", (state: any) => {
		const tokens = state.tokens;
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type !== "inline") {
				continue;
			}

			const children: any[] = tokens[i].children;
			if (!children || children.length === 0) {
				continue;
			}

			// The first child is the text node with the raw content
			const firstChild = children[0];
			if (!firstChild || firstChild.type !== "text") {
				continue;
			}

			const text: string = firstChild.content;
			const checkedMatch = text.match(/^\[x\]\s*/i);
			const uncheckedMatch = text.match(/^\[ \]\s*/);

			let boxHtml: string;
			let rest: string;

			if (checkedMatch) {
				boxHtml =
					'<span class="task-box task-checked">&#x2713;</span> ';
				rest = text.slice(checkedMatch[0].length);
			} else if (uncheckedMatch) {
				boxHtml = '<span class="task-box"></span> ';
				rest = text.slice(uncheckedMatch[0].length);
			} else {
				continue;
			}

			// Mutate the first child text node
			firstChild.content = rest;

			// Prepend the checkbox span as an html_inline token
			const box = new state.Token("html_inline", "", 0);
			box.content = boxHtml;
			children.unshift(box);

			// If inside a list item, add task-item class for CSS
			if (i >= 2 && tokens[i - 2]?.type === "list_item_open") {
				tokens[i - 2].attrSet("class", "task-item");
			}
		}
	});

	return md;
}

export function registerMarkdownPreviewProvider(
	context: vscode.ExtensionContext,
) {
	const provider = new CustomMarkdownPreviewProvider(context);
	let currentPanel: vscode.WebviewPanel | undefined;

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"theToyBox.openMarkdownPreview",
			async () => {
				const isEnabled = vscode.workspace
					.getConfiguration("theToyBox.markdownPreview")
					.get<boolean>("enabled", true);
				if (!isEnabled) {
					vscode.window.showInformationMessage(
						"Markdown Preview is disabled. Enable it in The Toy Box settings.",
					);
					return;
				}

				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					return;
				}

				if (currentPanel) {
					currentPanel.reveal(vscode.ViewColumn.Beside);
					provider.updatePreview(currentPanel, editor.document);
					return;
				}

				const panel = vscode.window.createWebviewPanel(
					"markdownPreview",
					"Markdown Preview",
					vscode.ViewColumn.Beside,
					{
						enableScripts: true,
						localResourceRoots: [context.extensionUri],
					},
				);
				currentPanel = panel;

				provider.updatePreview(panel, editor.document);

				let debounceTimer: ReturnType<typeof setTimeout> | undefined;

				const changeSubscription =
					vscode.workspace.onDidChangeTextDocument((e) => {
						if (
							currentPanel &&
							e.document ===
								vscode.window.activeTextEditor?.document
						) {
							if (debounceTimer) {
								clearTimeout(debounceTimer);
							}
							debounceTimer = setTimeout(() => {
								if (currentPanel) {
									provider.updatePreview(
										currentPanel,
										e.document,
									);
								}
							}, 300);
						}
					});

				const editorChangeSubscription =
					vscode.window.onDidChangeActiveTextEditor((e) => {
						if (
							e &&
							e.document.languageId === "markdown" &&
							currentPanel
						) {
							provider.updatePreview(currentPanel, e.document);
						}
					});

				panel.onDidDispose(() => {
					currentPanel = undefined;
					if (debounceTimer) {
						clearTimeout(debounceTimer);
					}
					changeSubscription.dispose();
					editorChangeSubscription.dispose();
				});
			},
		),
	);
}

class CustomMarkdownPreviewProvider {
	constructor(private context: vscode.ExtensionContext) {}

	updatePreview(panel: vscode.WebviewPanel, document: vscode.TextDocument) {
		const content = document.getText();
		const html = this.transformMarkdownToHtml(content);
		const fontUri = panel.webview.asWebviewUri(
			vscode.Uri.joinPath(
				this.context.extensionUri,
				"fonts",
				"MaterialSymbolsOutlined.woff2",
			),
		);
		panel.webview.html = this.getWebviewContent(html, fontUri.toString());
	}

	private transformMarkdownToHtml(markdown: string): string {
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
					alertCustomTitle = match[2]?.trim() || "";
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
							this.formatAlert(
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
						this.formatAlert(
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
			result += this.formatAlert(
				alertType,
				blockquoteContent.trim(),
				alertCustomTitle,
			);
		}

		return this.basicMarkdownToHtml(result);
	}

	private formatAlert(
		type: string,
		content: string,
		customTitle = "",
	): string {
		// Icon data: Material Symbols name and unicode fallback
		const iconData: {
			[key: string]: { name: string; unicode: string; title: string };
		} = {
			note: { name: "info", unicode: "ℹ", title: "Note" },
			tip: { name: "lightbulb", unicode: "💡", title: "Tip" },
			important: {
				name: "priority_high",
				unicode: "❗",
				title: "Important",
			},
			warning: { name: "warning", unicode: "⚠", title: "Warning" },
			caution: { name: "cancel", unicode: "🛑", title: "Caution" },
		};

		const alertInfo = iconData[type] || iconData.note;
		const displayTitle = customTitle || alertInfo.title;
		const safeTitle = displayTitle
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
		return `<div class="markdown-alert ${type}">\n<p class="alert-title"><span class="alert-icon">${alertInfo.name}</span> ${safeTitle}</p>\n<p>${content}</p>\n</div>`;
	}

	private basicMarkdownToHtml(markdown: string): string {
		// Protect fenced code blocks from further processing
		const codeBlocks: string[] = [];
		markdown = markdown.replace(/```[\s\S]*?```/g, (match) => {
			codeBlocks.push(match);
			return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
		});

		// Protect inline code
		const inlineCodes: string[] = [];
		markdown = markdown.replace(/`([^`]+)`/g, (_match, code) => {
			inlineCodes.push(code);
			return `%%INLINECODE_${inlineCodes.length - 1}%%`;
		});

		// Horizontal rules
		markdown = markdown.replace(/^(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "<hr>");

		// Headers h1–h6
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

		// Task lists (must come before unordered lists); dash prefix is optional
		markdown = markdown.replace(
			/^([ \t]*)(?:- )?\[x\] (.*)$/gim,
			(_m, _indent, text) => {
				return `<li class="task-item"><span class="task-box task-checked">&#x2713;</span> ${text}</li>`;
			},
		);
		markdown = markdown.replace(
			/^([ \t]*)(?:- )?\[ \] (.*)$/gm,
			(_m, _indent, text) => {
				return `<li class="task-item"><span class="task-box"></span> ${text}</li>`;
			},
		);
		// Close blank lines between consecutive task items so they group into one <ul>
		markdown = markdown.replace(
			/(<\/li>)\n\n(<li class="task-item">)/g,
			"$1\n$2",
		);
		// Wrap contiguous task list items in a <ul>
		markdown = markdown.replace(
			/((?:^<li class="task-item">.*\n?)+)/gm,
			(block) => {
				return `<ul class="task-list">${block.trimEnd()}</ul>`;
			},
		);
		// Unordered lists
		markdown = this._buildList(markdown, false);

		// Ordered lists
		markdown = this._buildList(markdown, true);

		// Images (must come before links)
		markdown = markdown.replace(
			/!\[([^\]]*)\]\(([^)]+)\)/g,
			'<img src="$2" alt="$1">',
		);

		// Links
		markdown = markdown.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			'<a href="$2">$1</a>',
		);

		// Bold and italic
		markdown = markdown.replace(
			/\*\*\*([^*]+)\*\*\*/g,
			"<strong><em>$1</em></strong>",
		);
		markdown = markdown.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
		markdown = markdown.replace(/\*([^*]+)\*/g, "<em>$1</em>");
		markdown = markdown.replace(/~~([^~]+)~~/g, "<del>$1</del>");

		// Restore inline code
		markdown = markdown.replace(/%%INLINECODE_(\d+)%%/g, (_m, i) => {
			const raw = inlineCodes[Number(i)];
			const escaped = raw
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");
			return `<code>${escaped}</code>`;
		});

		// Restore fenced code blocks
		markdown = markdown.replace(/%%CODEBLOCK_(\d+)%%/g, (_m, i) => {
			const raw = codeBlocks[Number(i)];
			const inner = raw.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
			const escaped = inner
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");
			return `<pre><code>${escaped}</code></pre>`;
		});

		// Paragraphs — wrap blocks not already wrapped in an HTML block tag
		markdown = markdown
			.split(/\n{2,}/)
			.map((para) => {
				para = para.trim();
				if (!para) {
					return "";
				}
				if (
					para.match(
						/^<(?:h[1-6]|p|pre|div|ul|ol|li|table|thead|tbody|tr|th|td|hr|img|blockquote)/i,
					)
				) {
					return para;
				}
				return `<p>${para.replace(/\n/g, " ")}</p>`;
			})
			.filter(Boolean)
			.join("\n");

		return markdown;
	}

	private _buildList(markdown: string, ordered: boolean): string {
		const itemRe = ordered
			? /^([ \t]*)\d+\. (.*)$/gm
			: /^([ \t]*)[-*+] (.*)$/gm;
		const tag = ordered ? "ol" : "ul";

		// Find contiguous blocks of list items and wrap them
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

	private getWebviewContent(html: string, fontUri: string): string {
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src ${fontUri}; img-src https: data:;">
				<title>Markdown Preview</title>
				<style>
					@font-face {
						font-family: 'Material Symbols Outlined';
						font-style: normal;
						font-weight: 400;
						src: url('${fontUri}') format('woff2');
					}
					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
						line-height: 1.6;
						color: #e1e4e8;
						background-color: #0d1117;
						padding: 32px;
						max-width: 900px;
						margin: 0 auto;
					}

					h1, h2, h3, h4, h5, h6 {
						color: #c9d1d9;
						margin-top: 24px;
						margin-bottom: 16px;
						font-weight: 600;
					}

h1 { font-size: 32px; border-bottom: 1px solid #30363d; padding-bottom: 8px; }
				h2 { font-size: 24px; border-bottom: 1px solid #30363d; padding-bottom: 6px; }
				h3 { font-size: 20px; }
				h4 { font-size: 16px; }
				h5 { font-size: 14px; }
				h6 { font-size: 13px; color: #8b949e; }

					p {
						margin: 0 0 16px 0;
					}

					code {
						background-color: rgba(110, 118, 129, 0.4);
						color: #79c0ff;
						padding: 2px 6px;
						border-radius: 3px;
						font-family: 'Monaco', 'Menlo', monospace;
						font-size: 0.85em;
					}

					pre {
						background-color: #161b22;
						border: 1px solid #30363d;
						border-radius: 6px;
						padding: 16px;
						overflow-x: auto;
						margin: 0 0 16px 0;
					}

					pre code {
						background-color: transparent;
						color: #79c0ff;
						padding: 0;
					}

					/* Alert Styles */
					.markdown-alert {
						padding: 16px;
						margin: 16px 0;
						border-left: 4px solid;
						border-radius: 6px;
					}

					.alert-title {
						font-weight: 600;
						margin: 0 0 8px 0;
						display: flex;
						align-items: center;
						gap: 8px;
					}

					.alert-icon {
						font-family: 'Material Symbols Outlined', -apple-system, san-serif;
						font-size: 24px;
						font-weight: 400;
						font-style: normal;
						font-variant: normal;
						text-transform: none;
						line-height: 1;
						display: inline-flex;
						align-items: center;
						justify-content: center;
						width: 28px;
						height: 28px;
						flex-shrink: 0;
						letter-spacing: normal;
						word-wrap: normal;
						white-space: nowrap;
						direction: ltr;
						-webkit-font-smoothing: antialiased;
						-moz-osx-font-smoothing: grayscale;
					}

					/* Alert type colors */
					.markdown-alert.note {
						background-color: rgba(0, 101, 196, 0.25);
						border-left-color: #0065c4;
					}

					.markdown-alert.tip {
						background-color: rgba(76, 104, 36, 0.25);
						border-left-color: #4c6824;
					}

					.markdown-alert.important {
						background-color: rgba(124, 32, 140, 0.25);
						border-left-color: #7c208c;
					}

					.markdown-alert.warning {
						background-color: rgba(165, 112, 22, 0.25);
						border-left-color: #a57016;
					}

					.markdown-alert.caution {
						background-color: rgba(187, 66, 39, 0.25);
						border-left-color: #bb4227;
					}

					/* Additional alert styling */
					.markdown-alert.note .alert-title {
						color: #58a6ff;
					}

					.markdown-alert.tip .alert-title {
						color: #3fb950;
					}

					.markdown-alert.important .alert-title {
						color: #d2a8ff;
					}

					.markdown-alert.warning .alert-title {
						color: #d29922;
					}

					.markdown-alert.caution .alert-title {
						color: #f85149;
					}

					.markdown-alert p {
						margin: 0;
						color: #e1e4e8;
					}

					.markdown-alert p:not(:first-child) {
						margin-top: 8px;
					}

					strong {
						color: #c9d1d9;
					}

					em {
						color: #c9d1d9;
					}

					del {
						color: #8b949e;
					}

					a {
						color: #58a6ff;
						text-decoration: none;
					}

					a:hover {
						text-decoration: underline;
					}

					img {
						max-width: 100%;
						border-radius: 6px;
					}

					hr {
						border: none;
						border-top: 1px solid #30363d;
						margin: 24px 0;
					}

					ul, ol {
						padding-left: 2em;
						margin: 0 0 16px 0;
					}

					li {
						margin: 4px 0;
					}

					ul.task-list {
						padding-left: 0;
						list-style: none;
					}

					li.task-item {
						list-style: none;
						display: flex;
						align-items: baseline;
						gap: 8px;
					}

					.task-box {
						display: inline-flex;
						align-items: center;
						justify-content: center;
						width: 14px;
						height: 14px;
						min-width: 14px;
						border: 1.5px solid #8b949e;
						border-radius: 3px;
						background-color: transparent;
						font-size: 11px;
						line-height: 1;
						color: transparent;
					}

					.task-box.task-checked {
						background-color: #1f6feb;
						border-color: #1f6feb;
						color: #ffffff;
					}

					table {
						border-collapse: collapse;
						width: 100%;
						margin: 0 0 16px 0;
					}

					th, td {
						border: 1px solid #30363d;
						padding: 8px 12px;
						text-align: left;
					}

					th {
						background-color: #161b22;
						font-weight: 600;
						color: #c9d1d9;
					}

					tr:nth-child(even) td {
						background-color: rgba(110, 118, 129, 0.1);
					}
				</style>
			</head>
			<body>
				${html}
			</body>
		</html>`;
	}
}
