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
			const html =
				`<div class="markdown-alert ${type}">` +
				`<p class="alert-title"><span class="alert-icon">${info.icon}</span> ${displayTitle}</p>` +
				`<p>${rendered}</p>` +
				`</div>\n`;

			const token = new state.Token("html_block", "", 0);
			token.content = html;
			tokens.splice(i, closeIdx - i + 1, token);
		}
	});

	return md;
}

export function registerMarkdownPreviewProvider(
	context: vscode.ExtensionContext,
) {
	const provider = new CustomMarkdownPreviewProvider(context);

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

				const panel = vscode.window.createWebviewPanel(
					"markdownPreview",
					"Markdown Preview",
					vscode.ViewColumn.Beside,
					{
						enableScripts: true,
						localResourceRoots: [context.extensionUri],
					},
				);

				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					return;
				}

				provider.updatePreview(panel, editor.document);
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
		return `<div class="markdown-alert ${type}">\n<p class="alert-title"><span class="alert-icon">${alertInfo.name}</span> ${displayTitle}</p>\n<p>${content}</p>\n</div>`;
	}

	private basicMarkdownToHtml(markdown: string): string {
		// Headers
		markdown = markdown.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
		markdown = markdown.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
		markdown = markdown.replace(/^# (.*?)$/gm, "<h1>$1</h1>");

		// Code blocks
		markdown = markdown.replace(
			/```([^`]*?)```/gs,
			"<pre><code>$1</code></pre>",
		);

		// Inline code
		markdown = markdown.replace(/`([^`]+)`/g, "<code>$1</code>");

		// Bold
		markdown = markdown.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

		// Italic
		markdown = markdown.replace(/\*([^*]+)\*/g, "<em>$1</em>");

		// Line breaks and paragraphs
		markdown = markdown
			.split("\n\n")
			.map((para) => {
				if (!para.match(/^<(?:h[1-6]|p|pre|div)/)) {
					return `<p>${para}</p>`;
				}
				return para;
			})
			.join("\n");

		return markdown;
	}

	private getWebviewContent(html: string, fontUri: string): string {
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src ${fontUri}; script-src 'unsafe-inline';">
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

					h1 { font-size: 32px; }
					h2 { font-size: 24px; }
					h3 { font-size: 20px; }

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
				</style>
			</head>
			<body>
				${html}
			</body>
		</html>`;
	}
}
