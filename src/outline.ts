import * as vscode from "vscode";

export class BetterOutlineProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "betterOutlineView";

	private _view?: vscode.WebviewView;
	private _isFetching = false;
	private _updateTimeout?: NodeJS.Timeout;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _context: vscode.ExtensionContext,
	) {}

	public resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((data) => {
			if (data.command === "jumpTo") {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					return;
				}

				const pos = new vscode.Position(data.line, 0);
				editor.selection = new vscode.Selection(pos, pos);
				editor.revealRange(
					new vscode.Range(pos, pos),
					vscode.TextEditorRevealType.InCenter,
				);
			}
		});

		// Sync selection highlight (debounced lightly)
		let selectionTimeout: NodeJS.Timeout | undefined;

		this._context.subscriptions.push(
			vscode.window.onDidChangeTextEditorSelection((e) => {
				if (!this._view?.visible) {
					return;
				}
				if (e.textEditor !== vscode.window.activeTextEditor) {
					return;
				}
				if (e.selections.length === 0) {
					return;
				}

				if (selectionTimeout) {
					clearTimeout(selectionTimeout);
				}

				selectionTimeout = setTimeout(() => {
					this._view?.webview.postMessage({
						command: "syncSelection",
						line: e.selections[0].active.line,
					});
				}, 100);
			}),
		);

		this._context.subscriptions.push(
			vscode.window.onDidChangeActiveTextEditor(() =>
				this.scheduleUpdate(),
			),
			vscode.workspace.onDidChangeTextDocument((e) => {
				if (e.document === vscode.window.activeTextEditor?.document) {
					this.scheduleUpdate();
				}
			}),
		);

		this.scheduleUpdate();
	}

	// Debounced update scheduler
	public postToWebview(message: object) {
		this._view?.webview.postMessage(message);
	}

	private scheduleUpdate() {
		if (!this._view?.visible) {
			return;
		}

		if (this._updateTimeout) {
			clearTimeout(this._updateTimeout);
		}

		this._updateTimeout = setTimeout(() => {
			this.update();
		}, 400);
	}

	public async update() {
		if (!this._view) {
			return;
		}
		if (!this._view.visible) {
			return;
		}
		if (this._isFetching) {
			return;
		}

		const config = vscode.workspace.getConfiguration("theToyBox");
		const showRegions = config.get<boolean>("showRegionsInOutline", true);
		if (!showRegions) {
			this._view.webview.postMessage({ command: "render", data: [] });
			return;
		}

		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		try {
			this._isFetching = true;

			let symbols =
				(await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
					"vscode.executeDocumentSymbolProvider",
					editor.document.uri,
				)) || [];

			const tree = this._buildRegionTree(editor.document, symbols);

			this._view.webview.postMessage({
				command: "render",
				data: tree,
			});
		} finally {
			this._isFetching = false;
		}
	}

	private _buildRegionTree(
		document: vscode.TextDocument,
		symbols: vscode.DocumentSymbol[],
	) {
		// 1. Setup & Configuration
		const config = vscode.workspace.getConfiguration(
			"theToyBox.customComments",
		);
		const stylingEnabled = config.get<boolean>("enabled", true);
		const commentColors =
			config.get<{ [key: string]: string }>("colors") || {};
		const labels = config.get<{ [key: string]: string }>("labels") || {};
		const showBackground = config.get<boolean>("showBackground", true);

		const rootItems: any[] = [];
		const regionStack: any[] = [];
		const claimedLines = new Set<number>();
		const triggerChars = Object.keys(commentColors);
		const commentPrefixes = ["//", "--", "#", "%", "'"];

		const allComments: any[] = [];
		const sqlEntities: any[] = [];
		const phpFunctions: any[] = [];

		const lang = document.languageId.toLowerCase();
		const isSqlFile = ["sql", "postgresql", "mssql", "postgres"].includes(
			lang,
		);
		const isPhpFile = lang === "php";
		const isMarkdownFile = lang === "markdown";

		// 2a. Markdown: parse headings into a nested tree
		if (isMarkdownFile) {
			const headingConfig = vscode.workspace.getConfiguration(
				"theToyBox.markdownHeadings",
			);
			const headingEnabled = headingConfig.get<boolean>("enabled", true);
			const headingColors =
				headingConfig.get<{ [key: string]: string }>("colors") || {};
			const showBackground = headingConfig.get<boolean>(
				"showBackground",
				true,
			);

			const rootHeadings: any[] = [];
			const stack: { level: number; item: any }[] = [];

			for (let i = 0; i < document.lineCount; i++) {
				const text = document.lineAt(i).text;
				const match = text.match(/^(#{1,6})\s+(.*)/);
				if (!match) {
					continue;
				}

				const level = match[1].length;
				const levelKey = `h${level}`;
				const color = headingEnabled ? headingColors[levelKey] : null;

				const item: any = {
					label: `${"#".repeat(level)} ${match[2].trim()}`,
					line: i,
					isMarkdownHeading: true,
					headingLevel: level,
					color: color || null,
					backgroundColor:
						color && showBackground ? color + "33" : null,
					isBold: level === 1,
					isRegion: false,
					children: [],
				};

				// Pop the stack until we find a heading of a higher level
				while (
					stack.length > 0 &&
					stack[stack.length - 1].level >= level
				) {
					stack.pop();
				}

				if (stack.length > 0) {
					const parent = stack[stack.length - 1].item;
					parent.children.push(item);
					parent.isRegion = true; // show caret
				} else {
					rootHeadings.push(item);
				}

				stack.push({ level, item });
			}

			return rootHeadings;
		}

		// 2. Pass 1: Identify Comments & SQL Entities (Tables, Procs, Funcs, Views) & PHP Functions
		for (let i = 0; i < document.lineCount; i++) {
			const line = document.lineAt(i);
			const text = line.text;
			const trimmed = text.trim();

			// --- PHP Function Detection ---
			if (isPhpFile) {
				// Match PHP function declarations: function functionName(...) {
				const phpFuncMatch = text.match(
					/^\s*(public|private|protected|static|async)?\s*function\s+(\w+)\s*\(/,
				);

				if (phpFuncMatch) {
					phpFunctions.push({
						label: phpFuncMatch[2] + "()",
						line: i,
						phpType: "function",
						isRegion: false,
						children: [],
					});
					continue;
				}
			}

			// --- SQL Entity Detection ---
			if (isSqlFile) {
				// Regex to match "CREATE [OR REPLACE] TABLE/VIEW/PROCEDURE/FUNCTION name"
				const tableMatch = text.match(/create\s+table\s+([\w\.]+)/i);
				const viewMatch = text.match(
					/create\s+(?:or\s+replace\s+)?view\s+([\w\.]+)/i,
				);
				const procMatch = text.match(
					/create\s+(?:or\s+replace\s+)?(?:stored\s+)?procedure\s+([\w\.]+)/i,
				);
				const funcMatch = text.match(
					/create\s+(?:or\s+replace\s+)?function\s+([\w\.]+)/i,
				);

				if (tableMatch) {
					sqlEntities.push({
						label: tableMatch[1],
						line: i,
						sqlType: "table",
						isRegion: false,
						children: [],
					});
					continue;
				} else if (procMatch) {
					sqlEntities.push({
						label: procMatch[1],
						line: i,
						sqlType: "procedure",
						isRegion: false,
						children: [],
					});
					continue;
				} else if (funcMatch) {
					sqlEntities.push({
						label: funcMatch[1],
						line: i,
						sqlType: "function",
						isRegion: false,
						children: [],
					});
					continue;
				} else if (viewMatch) {
					sqlEntities.push({
						label: viewMatch[1],
						line: i,
						sqlType: "view",
						isRegion: false,
						children: [],
					});
					continue;
				}
			}

			// --- Comment Scanning with String-Safe Logic ---
			let foundPrefix: string | undefined;
			let prefixIndex = -1;

			for (let charIdx = 0; charIdx < text.length; charIdx++) {
				const textBefore = text.substring(0, charIdx);
				const trimmedBefore = textBefore.trim();

				// Toggle-based string scanner fix
				const isInsideSingle =
					(textBefore.split("'").length - 1) % 2 !== 0;
				const isInsideDouble =
					(textBefore.split('"').length - 1) % 2 !== 0;
				if (isInsideSingle || isInsideDouble) {
					continue;
				}

				const currentPrefix = commentPrefixes.find((p) =>
					text.startsWith(p, charIdx),
				);
				if (currentPrefix) {
					// Strict check for SQL ' and # (must start the line)
					if (currentPrefix === "'" || currentPrefix === "#") {
						if (trimmedBefore.length > 0) {
							continue;
						}
						const after = text.substring(charIdx + 1);
						if (
							!triggerChars.some((s) =>
								after.trimStart().startsWith(s),
							) &&
							!after.startsWith(" ")
						) {
							continue;
						}
					}
					prefixIndex = charIdx;
					foundPrefix = currentPrefix;
					break;
				}
			}

			if (!foundPrefix || prefixIndex === -1) {
				continue;
			}

			// Skip region markers
			if (
				/^[#\/\-\*\s!]*region\s+/i.test(trimmed) ||
				/^[#\/\-\*\s!]*endregion/i.test(trimmed)
			) {
				continue;
			}

			const afterPrefix = text
				.substring(prefixIndex + foundPrefix.length)
				.trimStart();
			const triggerChar = triggerChars.find((char) => {
				if (!afterPrefix.startsWith(char)) {
					return false;
				}

				// For PHP dollar signs, don't treat it as a trigger if followed by a word character (variable)
				if (char === "$") {
					const charAfterTrigger = afterPrefix.charAt(char.length);
					if (/\w/.test(charAfterTrigger)) {
						return false; // It's a PHP variable, not a trigger
					}
				}

				return true;
			});

			let displayLabel = afterPrefix;
			if (triggerChar) {
				const replacementWord = labels[triggerChar];
				const contentOnly = afterPrefix
					.substring(triggerChar.length)
					.trimStart();
				displayLabel = replacementWord
					? `${replacementWord}: ${contentOnly}`
					: `${triggerChar}: ${contentOnly}`;
			}

			allComments.push({
				label: displayLabel,
				line: i,
				isComment: true,
				color:
					stylingEnabled && triggerChar
						? commentColors[triggerChar]
						: null,
				backgroundColor:
					stylingEnabled && triggerChar && showBackground
						? commentColors[triggerChar] + "33"
						: null,
				isBold: stylingEnabled && triggerChar === "!",
				isRegion: false,
				children: [],
			});
		}

		// 3. Helper for Nesting
		const nestContent = (symbolList: vscode.DocumentSymbol[]): any[] => {
			return symbolList.map((s) => {
				const formatted: any = {
					label: s.name,
					line: s.range.start.line,
					kind: s.kind,
					isRegion: true,
					children: [],
				};
				if (s.children?.length) {
					formatted.children.push(...nestContent(s.children));
				}
				const internalComments = allComments.filter(
					(c) =>
						s.range.contains(new vscode.Position(c.line, 0)) &&
						!claimedLines.has(c.line),
				);
				internalComments.forEach((c) => claimedLines.add(c.line));
				formatted.children.push(...internalComments);
				formatted.children.sort((a: any, b: any) => a.line - b.line);
				if (formatted.children.length === 0) {
					formatted.isRegion = false;
				}
				return formatted;
			});
		};

		// 4. Pass 2: #region Marker Hierarchy
		for (let i = 0; i < document.lineCount; i++) {
			const text = document.lineAt(i).text.trim();
			const startMatch = text.match(/^[#\/\-\*\s!]*region\s+(.*)/i);
			const endMatch = text.match(/^[#\/\-\*\s!]*endregion/i);

			if (startMatch) {
				regionStack.push({
					label: startMatch[1] || "Region",
					line: i,
					children: [],
					isRegion: true,
				});
			} else if (endMatch && regionStack.length > 0) {
				const region = regionStack.pop();
				const range = new vscode.Range(
					region.line,
					0,
					i,
					document.lineAt(i).text.length,
				);
				const internalSymbols = symbols.filter(
					(s) =>
						range.contains(s.range) &&
						!claimedLines.has(s.range.start.line),
				);
				region.children.push(...nestContent(internalSymbols));
				internalSymbols.forEach((s) =>
					claimedLines.add(s.range.start.line),
				);

				const internalSqlEntities = sqlEntities.filter(
					(e) =>
						e.line > region.line &&
						e.line < i &&
						!claimedLines.has(e.line),
				);
				internalSqlEntities.forEach((e) => claimedLines.add(e.line));
				region.children.push(...internalSqlEntities);

				const internalPhpFunctions = phpFunctions.filter(
					(f) =>
						f.line > region.line &&
						f.line < i &&
						!claimedLines.has(f.line),
				);
				internalPhpFunctions.forEach((f) => claimedLines.add(f.line));
				region.children.push(...internalPhpFunctions);

				const internalComments = allComments.filter(
					(c) =>
						c.line > region.line &&
						c.line < i &&
						!claimedLines.has(c.line),
				);
				internalComments.forEach((c) => claimedLines.add(c.line));
				region.children.push(...internalComments);

				region.children.sort((a: any, b: any) => a.line - b.line);
				claimedLines.add(region.line);
				claimedLines.add(i);
				if (regionStack.length > 0) {
					regionStack[regionStack.length - 1].children.push(region);
				} else {
					rootItems.push(region);
				}
			}
		}

		// 5. Final Assembly
		const standaloneSymbols = symbols.filter(
			(s) => !claimedLines.has(s.range.start.line),
		);
		return [
			...rootItems,
			...sqlEntities.filter((e) => !claimedLines.has(e.line)),
			...phpFunctions.filter((f) => !claimedLines.has(f.line)),
			...nestContent(standaloneSymbols),
			...allComments.filter((c) => !claimedLines.has(c.line)),
		].sort((a, b) => a.line - b.line);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return `<!DOCTYPE html>
			<html>
			<head>
			<style>@font-face { font-family: 'Material Symbols Outlined'; font-style: normal; font-weight: 400; src: url('${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "fonts", "MaterialSymbolsOutlined.woff2"))}') format('woff2'); }</style>
			<style>
			body {
				font-family: var(--vscode-font-family);
				color: var(--vscode-foreground);
				padding: 10px;
				font-size: var(--vscode-font-size);
				user-select: none;
			}
			.tree-item {
				cursor: pointer;
				padding: 2px 8px;
				display: flex;
				align-items: center;
				border-radius: 4px;
				margin: 1px 0;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.tree-item:hover {
				background: var(--vscode-list-hoverBackground) !important;
			}
			.selected {
				background: var(--vscode-list-activeSelectionBackground) !important;
				color: var(--vscode-list-activeSelectionForeground) !important;
				border-radius: 4px;
			}
			.region {
				font-weight: bold;
				color: var(--vscode-symbolIcon-namespaceForeground);
				margin-top: 4px;
			}
			.comment {
				font-style: italic;
				opacity: 0.85;
				font-size: 0.9em;
			}
			.children-container {
				display: block;
				margin-left: 12px;
				border-left: 1px solid var(--vscode-tree-indentGuidesStroke);
			}
			.children-container.collapsed {
				display: none;
			}
			.caret {
				display: inline-block;
				width: 14px;
				transition: transform 0.1s ease;
				font-size: 0.7em;
				margin-right: 4px;
				text-align: center;
			}
			.collapsed-caret {
				transform: rotate(-90deg);
			}
			.icon {
				margin-right: 6px;
				width: 20px;
				height: 20px;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				font-size: 18px;
				flex-shrink: 0;
			}
			.material-symbols-outlined {
				font-family: 'Material Symbols Outlined';
				font-weight: normal;
				font-style: normal;
				font-size: 18px;
				display: inline-block;
				line-height: 1;
				text-transform: none;
				letter-spacing: normal;
				word-wrap: normal;
				white-space: nowrap;
				direction: ltr;
			}
			</style>
			</head>
			<body>
			<div id="container"></div>
			<script>
			const vscode = acquireVsCodeApi();

			function getIcon(item) {
				if (item.isMarkdownHeading) return '<span class="material-symbols-outlined">title</span>';
				if (item.isComment) return '<span class="material-symbols-outlined">comment</span>';
				if (item.isRegion && !item.kind) return '<span class="material-symbols-outlined">folder</span>';

				// Custom PHP types
				if (item.phpType === 'function') return '<span class="material-symbols-outlined">functions</span>';

				// Custom SQL types
				if (item.sqlType === 'table') return '<span class="material-symbols-outlined">table_chart</span>';
				if (item.sqlType === 'procedure') return '<span class="material-symbols-outlined">storage</span>';
				if (item.sqlType === 'function') return '<span class="material-symbols-outlined">functions</span>';
				if (item.sqlType === 'view') return '<span class="material-symbols-outlined">visibility</span>';

				switch(item.kind) {
					case 4: return '<span class="material-symbols-outlined">school</span>'; // Class
					case 5: return '<span class="material-symbols-outlined">settings</span>'; // Method
					case 11: return '<span class="material-symbols-outlined">folder</span>'; // Module
					case 12: return '<span class="material-symbols-outlined">diamond</span>'; // Property
					default: return '<span class="material-symbols-outlined">circle</span>';
				}
			}

			function render(items, parentElement) {
				items.forEach(item => {
					const wrapper = document.createElement('div');
					const row = document.createElement('div');

					row.className =
						'tree-item ' +
						(item.isRegion
							? 'region'
							: (item.isComment ? 'comment' : 'symbol'));

					row.setAttribute('data-line', item.line);

					if (item.color) row.style.color = item.color;
					if (item.isBold) row.style.fontWeight = 'bold';
					if (item.backgroundColor)
						row.style.backgroundColor = item.backgroundColor;

					const hasChildren =
						item.children && item.children.length > 0;

					const caret = hasChildren
						? '<span class="caret">▼</span>'
						: '<span class="caret"></span>';

					row.innerHTML =
						caret +
						'<span class="icon">' +
						getIcon(item) +
						'</span>' +
						item.label;

					row.onclick = () => {
						if (hasChildren) {
							const container =
								wrapper.querySelector('.children-container');
							const caretEl =
								row.querySelector('.caret');

							container.classList.toggle('collapsed');
							caretEl.classList.toggle('collapsed-caret');
							return;
						}

						vscode.postMessage({
							command: 'jumpTo',
							line: item.line
						});
					};

					wrapper.appendChild(row);

					if (hasChildren) {
						const childContainer =
							document.createElement('div');

						childContainer.className =
							'children-container';

						render(item.children, childContainer);
						wrapper.appendChild(childContainer);
					}

					parentElement.appendChild(wrapper);
				});
			}

			window.addEventListener('message', event => {
				const msg = event.data;

				if (msg.command === 'render') {
					const container =
						document.getElementById('container');
					container.innerHTML = '';
					render(msg.data, container);
				} else if (msg.command === 'collapseAll') {
					document.querySelectorAll('.children-container')
						.forEach(c => c.classList.add('collapsed'));
					document.querySelectorAll('.caret')
						.forEach(c => c.classList.add('collapsed-caret'));
				} else if (msg.command === 'expandAll') {
					document.querySelectorAll('.children-container')
						.forEach(c => c.classList.remove('collapsed'));
					document.querySelectorAll('.caret')
						.forEach(c => c.classList.remove('collapsed-caret'));
				} else if (msg.command === 'syncSelection') {
					document.querySelectorAll('.tree-item')
						.forEach(el => el.classList.remove('selected'));

					const items =
						Array.from(document.querySelectorAll('.tree-item')).reverse();

					const target =
						items.find(el =>
							parseInt(el.getAttribute('data-line')) <= msg.line
						);

					if (target) {
						target.classList.add('selected');
						target.scrollIntoView({
							behavior: 'smooth',
							block: 'nearest'
						});

						let parent =
							target.parentElement.closest('.children-container');

						while (parent) {
							parent.classList.remove('collapsed');

							const caret =
								parent.previousElementSibling
									.querySelector('.caret');

							if (caret)
								caret.classList.remove('collapsed-caret');

							parent =
								parent.parentElement.closest('.children-container');
						}
					}
				}
			});
			</script>
			</body>
			</html>`;
	}
}

export function registerBetterOutline(context: vscode.ExtensionContext) {
	const provider = new BetterOutlineProvider(context.extensionUri, context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			BetterOutlineProvider.viewType,
			provider,
		),
		vscode.commands.registerCommand("betterOutline.collapseAll", () => {
			provider.postToWebview({ command: "collapseAll" });
		}),
		vscode.commands.registerCommand("betterOutline.expandAll", () => {
			provider.postToWebview({ command: "expandAll" });
		}),
	);
}
