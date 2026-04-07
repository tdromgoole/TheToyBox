import * as vscode from "vscode";
import { parseMarkdown } from "./outline/parseMarkdown";
import { parseCss } from "./outline/parseCss";
import { parseKdl } from "./outline/parseKdl";
import { collectEntities } from "./outline/collectEntities";

export class BetterOutlineProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "betterOutlineView";

	private _view?: vscode.WebviewView;
	private _isFetching = false;
	private _updateTimeout?: NodeJS.Timeout;
	private _highlightDecoration?: vscode.TextEditorDecorationType;
	private _highlightTimeout?: NodeJS.Timeout;

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

				const config = vscode.workspace.getConfiguration("theToyBox");
				if (config.get<boolean>("outline.highlightOnClick", true)) {
					if (!this._highlightDecoration) {
						this._highlightDecoration =
							vscode.window.createTextEditorDecorationType({
								isWholeLine: true,
								backgroundColor: new vscode.ThemeColor(
									"editor.findMatchHighlightBackground",
								),
								borderRadius: "3px",
							});
					}

					if (this._highlightTimeout) {
						clearTimeout(this._highlightTimeout);
					}

					const lineRange = editor.document.lineAt(data.line).range;
					editor.setDecorations(this._highlightDecoration, [
						lineRange,
					]);

					this._highlightTimeout = setTimeout(() => {
						this._highlightDecoration?.dispose();
						this._highlightDecoration = undefined;
						this._highlightTimeout = undefined;
					}, 1500);
				}
			}
		});

		// Sync selection highlight (debounced lightly)
		let selectionTimeout: NodeJS.Timeout | undefined;

		// Use a per-view disposable array so listeners are cleaned up if the
		// webview is torn down and resolveWebviewView is called again.
		const viewDisposables: vscode.Disposable[] = [];

		viewDisposables.push(
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
			vscode.window.onDidChangeActiveTextEditor(() =>
				this.scheduleUpdate(),
			),
			vscode.workspace.onDidChangeTextDocument((e) => {
				if (e.document === vscode.window.activeTextEditor?.document) {
					this.scheduleUpdate();
				}
			}),
		);

		webviewView.onDidDispose(() => {
			viewDisposables.forEach((d) => d.dispose());
			if (selectionTimeout) {
				clearTimeout(selectionTimeout);
				selectionTimeout = undefined;
			}
			if (this._highlightTimeout) {
				clearTimeout(this._highlightTimeout);
				this._highlightTimeout = undefined;
			}
			this._highlightDecoration?.dispose();
			this._highlightDecoration = undefined;
			if (this._updateTimeout) {
				clearTimeout(this._updateTimeout);
				this._updateTimeout = undefined;
			}
			if (this._view === webviewView) {
				this._view = undefined;
			}
		});

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
		} catch (e: any) {
			// Ignore cancellation errors that occur when the extension host shuts down
			if (e?.message !== "Canceled" && e?.name !== "Canceled") {
				throw e;
			}
		} finally {
			this._isFetching = false;
		}
	}

	private _buildRegionTree(
		document: vscode.TextDocument,
		symbols: vscode.DocumentSymbol[],
	) {
		const rootItems: any[] = [];
		const regionStack: any[] = [];
		const claimedLines = new Set<number>();

		const lang = document.languageId.toLowerCase();
		const isMarkdownFile = lang === "markdown";
		const isCssFile = ["css", "scss", "less"].includes(lang);
		const isTsJsFile = [
			"javascript",
			"typescript",
			"javascriptreact",
			"typescriptreact",
		].includes(lang);
		const isJsFile = ["javascript", "javascriptreact"].includes(lang);
		const isKdlFile = lang === "kdl";

		// 2a. Markdown: parse headings into a nested tree
		if (isMarkdownFile) {
			return parseMarkdown(document);
		}

		// 2a-css. CSS/SCSS/Less: parse at-rules, selectors, custom properties, #regions
		if (isCssFile) {
			return parseCss(document);
		}

		// 2a-kdl. KDL: parse nodes into a hierarchical tree
		if (isKdlFile) {
			return parseKdl(document);
		}

		// 2. Pass 1: collect all entities and comments in a single pass
		const { allComments, sqlEntities, phpFunctions, tsJsItems } =
			collectEntities(document);

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

		// 3b. Enrich TS/JS items with children from the language server symbol tree
		// jQuery events are excluded — they have no meaningful LS children and
		// enrichment would accidentally claim their own line, hiding them from the output.
		if (isTsJsFile) {
			for (const item of tsJsItems) {
				if (item.tsJsType === "jqueryEvent") {
					continue;
				}
				const matchingSym = symbols.find(
					(s) => Math.abs(s.range.start.line - item.line) <= 1,
				);
				if (matchingSym) {
					item.endLine = matchingSym.range.end.line;
					// JS files: only use the LS symbol for endLine — no children,
					// no claimed lines. Comments are nested separately in step 5.
					if (!isJsFile) {
						claimedLines.add(matchingSym.range.start.line);
						if (matchingSym.children?.length) {
							item.children.push(
								...nestContent(matchingSym.children),
							);
							item.isRegion = true;
						}
					}
				}
			}
		}

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

				const internalTsJsItems = tsJsItems.filter(
					(t) =>
						t.line > region.line &&
						t.line < i &&
						!claimedLines.has(t.line),
				);
				internalTsJsItems.forEach((t) => claimedLines.add(t.line));
				region.children.push(...internalTsJsItems);

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

		// For JS files: nest unclaimed comments inside their containing function
		if (isJsFile) {
			const jsFunctions = tsJsItems.filter(
				(t) =>
					(t.tsJsType === "function" ||
						t.tsJsType === "arrowFunction" ||
						t.tsJsType === "jqueryEvent") &&
					!claimedLines.has(t.line),
			);
			for (const fn of jsFunctions) {
				const fnEnd = fn.endLine ?? document.lineCount;
				const nested = allComments.filter(
					(c) =>
						!claimedLines.has(c.line) &&
						c.line > fn.line &&
						c.line <= fnEnd,
				);
				if (nested.length > 0) {
					nested.forEach((c) => claimedLines.add(c.line));
					fn.children.push(...nested);
					fn.children.sort((a: any, b: any) => a.line - b.line);
					fn.isRegion = true;
				}
			}
		}

		return [
			...rootItems,
			...sqlEntities.filter((e) => !claimedLines.has(e.line)),
			...phpFunctions.filter((f) => !claimedLines.has(f.line)),
			...tsJsItems.filter((t) => !claimedLines.has(t.line)),
			...(isJsFile ? [] : nestContent(standaloneSymbols)),
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
			.empty-state {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				padding: 32px 16px;
				text-align: center;
				gap: 8px;
				opacity: 0.6;
			}
			.empty-state .material-symbols-outlined {
				font-size: 36px;
			}
			.empty-state p {
				margin: 0;
				font-size: 13px;
			}
			.empty-state .hint {
				font-size: 11px;
				opacity: 0.75;
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

				// Custom KDL types
				if (item.kdlType === 'node') return '<span class="material-symbols-outlined">schema</span>';

				// Custom PHP types
				if (item.phpType === 'function') return '<span class="material-symbols-outlined">functions</span>';

				// Custom TS/JS types
				if (item.tsJsType === 'class') return '<span class="material-symbols-outlined">category</span>';
				if (item.tsJsType === 'function') return '<span class="material-symbols-outlined">functions</span>';
				if (item.tsJsType === 'arrowFunction') return '<span class="material-symbols-outlined">arrow_forward</span>';
				if (item.tsJsType === 'jqueryEvent' && item.jquerySelector === 'id') return '<span class="material-symbols-outlined">tag</span>';
				if (item.tsJsType === 'jqueryEvent' && item.jquerySelector === 'class') return '<span class="material-symbols-outlined">label</span>';

				// Custom SQL types
				if (item.sqlType === 'table') return '<span class="material-symbols-outlined">table_chart</span>';
				if (item.sqlType === 'procedure') return '<span class="material-symbols-outlined">storage</span>';
				if (item.sqlType === 'function') return '<span class="material-symbols-outlined">functions</span>';
				if (item.sqlType === 'view') return '<span class="material-symbols-outlined">visibility</span>';

				// Custom CSS/SCSS/Less types
				if (item.cssType === 'media') return '<span class="material-symbols-outlined">devices</span>';
				if (item.cssType === 'keyframes') return '<span class="material-symbols-outlined">animation</span>';
				if (item.cssType === 'mixin') return '<span class="material-symbols-outlined">functions</span>';
				if (item.cssType === 'customProp') return '<span class="material-symbols-outlined">variable_insert</span>';
				if (item.cssType === 'selector' && item.cssSelector === 'id') return '<span class="material-symbols-outlined">tag</span>';
				if (item.cssType === 'selector' && item.cssSelector === 'class') return '<span class="material-symbols-outlined">label</span>';
				if (item.cssType === 'selector') return '<span class="material-symbols-outlined">style</span>';
				if (item.cssType) return '<span class="material-symbols-outlined">code</span>';

				if (item.isRegion && !item.kind) return '<span class="material-symbols-outlined">folder</span>';

				switch(item.kind) {
					case 4:  return '<span class="material-symbols-outlined">category</span>';    // Class
					case 5:  return '<span class="material-symbols-outlined">settings</span>';    // Method
					case 6:  return '<span class="material-symbols-outlined">tune</span>';        // Property
					case 8:  return '<span class="material-symbols-outlined">build</span>';       // Constructor
					case 10: return '<span class="material-symbols-outlined">layers</span>';      // Interface
					case 11: return '<span class="material-symbols-outlined">functions</span>';   // Function
					case 12: return '<span class="material-symbols-outlined">data_object</span>'; // Variable
					case 13: return '<span class="material-symbols-outlined">lock</span>';        // Constant
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
					const collapsible = hasChildren && !item.isMarkdownHeading;

					const caret = collapsible
						? '<span class="caret">▼</span>'
						: '<span class="caret"></span>';

					row.innerHTML =
						caret +
						'<span class="icon">' +
						getIcon(item) +
						'</span>' +
						item.label;

					row.onclick = () => {
						if (collapsible) {
							const container =
								wrapper.querySelector('.children-container');
							const caretEl =
								row.querySelector('.caret');

							container.classList.toggle('collapsed');
							caretEl.classList.toggle('collapsed-caret');
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
					if (!msg.data || msg.data.length === 0) {
						container.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">manage_search</span><p>No symbols found.</p><p class="hint">A language extension may be needed, or this file type may not be supported.</p></div>';
						return;
					}
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
