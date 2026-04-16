import * as vscode from "vscode";
import { parseMarkdown } from "./outline/parseMarkdown";
import { parseCss } from "./outline/parseCss";
import { parseKdl } from "./outline/parseKdl";
import { parseNginx } from "./outline/parseNginx";
import { parseJs } from "./outline/parseJs";
import { parseYaml } from "./outline/parseYaml";
import { parseIni } from "./outline/parseIni";
import { parseJson } from "./outline/parseJson";
import { collectEntities } from "./outline/collectEntities";

function getNonce(): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let nonce = "";
	for (let i = 0; i < 32; i++) {
		nonce += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return nonce;
}

export class BetterOutlineProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "betterOutlineView";

	private _view?: vscode.WebviewView;
	private _isFetching = false;
	private _pendingUpdate = false;
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

		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				this.scheduleUpdate();
			}
		});

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
			this._pendingUpdate = true;
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
			if (this._pendingUpdate) {
				this._pendingUpdate = false;
				this.scheduleUpdate();
			}
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
		const isKdlFile = lang === "kdl";
		const isNginxFile =
			lang === "nginx" ||
			lang === "NGINX" ||
			document.fileName.endsWith(".conf");
		const isYamlFile = ["yaml", "yml"].includes(lang);
		const isIniFile =
			lang === "ini" ||
			lang === "properties" ||
			document.fileName.endsWith(".ini") ||
			document.fileName.endsWith(".cfg") ||
			document.fileName.endsWith(".env");
		const isJsonFile = ["json", "jsonc", "json5", "jsonl"].includes(lang);

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

		// 2a-nginx. Nginx: parse block directives into a hierarchical tree
		if (isNginxFile) {
			return parseNginx(document);
		}

		// 2a-js. JS/TS/JSX/TSX: parse functions, classes, jQuery events, comments
		if (isTsJsFile) {
			return parseJs(document, symbols);
		}

		// 2a-yaml. YAML: parse keys into a nested tree based on indentation
		if (isYamlFile) {
			return parseYaml(document);
		}

		// 2a-ini. INI/Properties: parse sections and key-value pairs
		if (isIniFile) {
			return parseIni(document);
		}

		// 2a-json. JSON/JSONC: parse keys with adaptive depth for large files
		if (isJsonFile) {
			return parseJson(document);
		}

		// 2. Pass 1: collect all entities and comments in a single pass
		const { allComments, sqlEntities, phpFunctions } =
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

		// Flush any unclosed regions
		while (regionStack.length > 0) {
			const region = regionStack.pop();
			if (regionStack.length > 0) {
				regionStack[regionStack.length - 1].children.push(region);
			} else {
				rootItems.push(region);
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
		const nonce = getNonce();
		const fontUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._extensionUri,
				"fonts",
				"MaterialSymbolsOutlined.woff2",
			),
		);
		return `<!DOCTYPE html>
			<html>
			<head>
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
			<style>@font-face { font-family: 'Material Symbols Outlined'; font-style: normal; font-weight: 400; src: url('${fontUri}') format('woff2'); }</style>
			<style>
			body {
				font-family: var(--vscode-font-family);
				color: var(--vscode-foreground);
				padding: 10px;
				font-size: var(--vscode-font-size);
				user-select: none;
			}
			#search {
				width: 100%;
				padding: 4px 8px;
				margin-bottom: 6px;
				background: var(--vscode-input-background);
				color: var(--vscode-input-foreground);
				border: 1px solid var(--vscode-input-border, transparent);
				border-radius: 3px;
				font-size: var(--vscode-font-size);
				outline: none;
				box-sizing: border-box;
			}
			#search:focus { border-color: var(--vscode-focusBorder); }
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
				overflow: hidden;
			}
			.tree-label {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				min-width: 0;
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
			<input id="search" type="text" placeholder="Filter symbols\u2026" autocomplete="off" spellcheck="false" />
			<div id="container"></div>
			<script nonce="${nonce}">
			const vscode = acquireVsCodeApi();

			function getIcon(item) {
				if (item.isMarkdownHeading) return '<span class="material-symbols-outlined">title</span>';
				if (item.isComment) return '<span class="material-symbols-outlined">comment</span>';

				// Custom KDL types
				if (item.kdlType === 'node') return '<span class="material-symbols-outlined">schema</span>';

				// Custom Nginx types
				if (item.nginxType === 'http') return '<span class="material-symbols-outlined">language</span>';
				if (item.nginxType === 'server') return '<span class="material-symbols-outlined">dns</span>';
				if (item.nginxType === 'location') return '<span class="material-symbols-outlined">link</span>';
				if (item.nginxType === 'upstream') return '<span class="material-symbols-outlined">share</span>';
				if (item.nginxType === 'events') return '<span class="material-symbols-outlined">bolt</span>';
				if (item.nginxType === 'stream') return '<span class="material-symbols-outlined">stream</span>';
				if (item.nginxType === 'map') return '<span class="material-symbols-outlined">swap_horiz</span>';
				if (item.nginxType === 'if') return '<span class="material-symbols-outlined">help</span>';
				if (item.nginxType === 'block') return '<span class="material-symbols-outlined">data_object</span>';
				if (item.nginxType === 'directive') return '<span class="material-symbols-outlined">tune</span>';
				if (item.nginxType) return '<span class="material-symbols-outlined">settings</span>';

				// Custom YAML types
				if (item.yamlType === 'mapping') return '<span class="material-symbols-outlined">account_tree</span>';
				if (item.yamlType === 'scalar') return '<span class="material-symbols-outlined">data_object</span>';

				// Custom INI types
				if (item.iniType === 'section') return '<span class="material-symbols-outlined">folder</span>';
				if (item.iniType === 'key') return '<span class="material-symbols-outlined">tune</span>';

				// Custom JSON types
				if (item.jsonType === 'object') return '<span class="material-symbols-outlined">data_object</span>';
				if (item.jsonType === 'array') return '<span class="material-symbols-outlined">data_array</span>';
				if (item.jsonType === 'value') return '<span class="material-symbols-outlined">tag</span>';

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

			function escapeHtml(str) {
				return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
						'<span class="tree-label">' + escapeHtml(item.label) + '</span>';

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
					// Re-apply active search filter after re-render
					const sq = document.getElementById('search');
					if (sq && sq.value) {
						sq.dispatchEvent(new Event('input'));
					}
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

			// ── Search / filter ──
			const searchInput = document.getElementById('search');
			searchInput.addEventListener('input', function() {
				const q = this.value.toLowerCase();
				const container = document.getElementById('container');
				if (!q) {
					// Show everything
					container.querySelectorAll('[data-line]').forEach(el => {
						el.style.display = '';
					});
					container.querySelectorAll('.children-container').forEach(el => {
						el.style.display = '';
					});
					return;
				}
				// First hide everything
				container.querySelectorAll('.tree-item').forEach(el => {
					el.style.display = 'none';
				});
				container.querySelectorAll('.children-container').forEach(el => {
					el.style.display = 'none';
				});
				// Show items matching the query + their ancestors
				container.querySelectorAll('.tree-item').forEach(el => {
					const labelEl = el.querySelector('.tree-label');
					const label = (labelEl ? labelEl.textContent : el.textContent || '').toLowerCase();
					if (label.includes(q)) {
						el.style.display = '';
						// Show all ancestor containers
						let parent = el.parentElement;
						while (parent && parent !== container) {
							if (parent.classList.contains('children-container')) {
								parent.style.display = '';
								parent.classList.remove('collapsed');
								const caret = parent.previousElementSibling
									? parent.previousElementSibling.querySelector('.caret')
									: null;
								if (caret) caret.classList.remove('collapsed-caret');
							}
							if (parent.classList.contains('tree-item')) {
								parent.style.display = '';
							}
							parent = parent.parentElement;
						}
					}
				});
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
