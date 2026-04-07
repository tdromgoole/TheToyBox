import * as vscode from "vscode";

/**
 * Scan forward from startLine counting braces to find the closing `}` of a CSS block.
 */
function findCssBlockEnd(
	document: vscode.TextDocument,
	startLine: number,
): number {
	let depth = 0;
	let started = false;
	for (let i = startLine; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		for (const ch of text) {
			if (ch === "{") {
				depth++;
				started = true;
			} else if (ch === "}" && started) {
				depth--;
				if (depth === 0) {
					return i;
				}
			}
		}
	}
	return document.lineCount - 1;
}

/**
 * Starting from the line where a jQuery handler is detected, scan forward
 * counting braces to find the line of the closing `});`.
 */
function findJqueryHandlerEnd(
	document: vscode.TextDocument,
	startLine: number,
): number {
	let depth = 0;
	let started = false;
	for (let i = startLine; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		for (const ch of text) {
			if (ch === "{") {
				depth++;
				started = true;
			} else if (ch === "}" && started) {
				depth--;
				if (depth === 0) {
					return i;
				}
			}
		}
	}
	return document.lineCount - 1;
}

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
		const tsJsItems: any[] = [];
		const cssItems: any[] = [];

		const lang = document.languageId.toLowerCase();
		const isSqlFile = ["sql", "postgresql", "mssql", "postgres"].includes(
			lang,
		);
		const isPhpFile = lang === "php";
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
			const headingConfig = vscode.workspace.getConfiguration(
				"theToyBox.markdownHeadings",
			);
			const headingEnabled = headingConfig.get<boolean>("enabled", true);
			const headingColors =
				headingConfig.get<{ [key: string]: string }>("colors") || {};
			const headingShowBackground = headingConfig.get<boolean>(
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
					label: match[2].trim(),
					line: i,
					isMarkdownHeading: true,
					headingLevel: level,
					color: color || null,
					backgroundColor:
						color && headingShowBackground ? color + "33" : null,
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
				} else {
					rootHeadings.push(item);
				}

				stack.push({ level, item });
			}

			return rootHeadings;
		}

		// 2a-css. CSS/SCSS/Less: parse at-rules, selectors, custom properties, #regions
		if (isCssFile) {
			const atRuleRe =
				/^\s*(@(?:media|keyframes|mixin|include|layer|supports|font-face|charset|import|use|forward|each|for|if|else|while|function|return|debug|warn|error))\b([^{;]*)/i;
			const selectorRe =
				/^\s*([.#]?[\w][\w\s.#>+~[\]:()=*^$|"'-]*)(?:\s*,\s*[\w.#][\w\s.#>+~[\]:()=*^$|"'-]*)?\s*\{/;
			const customPropRe = /^\s*(--[\w-]+)\s*:/;
			const regionStartRe = /^[#\/\-\*\s!]*region\s+(.*)/i;
			const regionEndRe = /^[#\/\-\*\s!]*endregion/i;

			const cssRegionStack: any[] = [];
			const cssRootItems: any[] = [];

			const pushCssItem = (item: any) => {
				if (cssRegionStack.length > 0) {
					cssRegionStack[cssRegionStack.length - 1].children.push(
						item,
					);
				} else {
					cssRootItems.push(item);
				}
			};

			for (let i = 0; i < document.lineCount; i++) {
				const text = document.lineAt(i).text;
				const trimmed = text.trim();

				// Check for region markers before skipping comment lines
				const regionStartMatch = trimmed.match(regionStartRe);
				if (regionStartMatch) {
					const label =
						regionStartMatch[1].replace(/\*\/\s*$/, "").trim() ||
						"Region";
					cssRegionStack.push({
						label,
						line: i,
						isRegion: true,
						children: [],
					});
					continue;
				}
				if (regionEndRe.test(trimmed)) {
					if (cssRegionStack.length > 0) {
						const region = cssRegionStack.pop();
						if (cssRegionStack.length > 0) {
							cssRegionStack[
								cssRegionStack.length - 1
							].children.push(region);
						} else {
							cssRootItems.push(region);
						}
					}
					continue;
				}

				if (
					!trimmed ||
					trimmed.startsWith("//") ||
					trimmed.startsWith("/*") ||
					trimmed.startsWith("*")
				) {
					continue;
				}

				const atMatch = trimmed.match(atRuleRe);
				if (atMatch) {
					const keyword = atMatch[1].toLowerCase();
					const detail = atMatch[2].trim();
					const label = detail ? `${keyword} ${detail}` : keyword;
					const endLine = trimmed.endsWith("{")
						? findCssBlockEnd(document, i)
						: i;
					pushCssItem({
						label,
						line: i,
						endLine,
						cssType: keyword.slice(1), // strip @
						isRegion: endLine > i,
						children: [],
					});
					continue;
				}

				const propMatch = trimmed.match(customPropRe);
				if (propMatch) {
					pushCssItem({
						label: propMatch[1],
						line: i,
						cssType: "customProp",
						isRegion: false,
						children: [],
					});
					continue;
				}

				if (selectorRe.test(trimmed)) {
					// Collapse multi-line selectors to first 60 chars
					const label = trimmed
						.replace(/\s*\{.*$/, "")
						.trim()
						.slice(0, 60);
					const selectorKind = trimmed.trimStart().startsWith("#")
						? "id"
						: trimmed.trimStart().startsWith(".")
							? "class"
							: "element";
					pushCssItem({
						label,
						line: i,
						endLine: findCssBlockEnd(document, i),
						cssType: "selector",
						cssSelector: selectorKind,
						isRegion: false,
						children: [],
					});
				}
			}

			// Flush any unclosed regions to root
			while (cssRegionStack.length > 0) {
				cssRootItems.push(cssRegionStack.pop());
			}

			return cssRootItems.sort((a, b) => a.line - b.line);
		}

		// 2a-kdl. KDL: parse nodes into a hierarchical tree
		if (isKdlFile) {
			const kdlRoot: any[] = [];
			const kdlStack: any[] = []; // stack of open container nodes

			for (let i = 0; i < document.lineCount; i++) {
				const trimmed = document.lineAt(i).text.trim();

				// Skip blank lines, line comments, and block comment lines
				if (
					!trimmed ||
					trimmed.startsWith("//") ||
					trimmed.startsWith("/*") ||
					trimmed.startsWith("*")
				) {
					continue;
				}

				// Closing brace → pop the stack
				if (trimmed === "}" || trimmed === "};") {
					if (kdlStack.length > 0) {
						kdlStack.pop();
					}
					continue;
				}

				// Extract node name: bare identifier or quoted string
				let nodeName: string | null = null;
				let nameEnd = 0;
				const bareMatch = trimmed.match(/^([-\w$.:]+)/);
				const quotedMatch = trimmed.match(/^"((?:[^"\\]|\\.)*)"/);
				if (bareMatch) {
					nodeName = bareMatch[1];
					nameEnd = bareMatch[0].length;
				} else if (quotedMatch) {
					nodeName = `"${quotedMatch[1]}"`;
					nameEnd = quotedMatch[0].length;
				}
				if (!nodeName) {
					continue;
				}

				// Extract the first argument after the node name.
				// - key="value" or key=bare  → "key value" (no = or quotes)
				// - "positional string"       → the unquoted string
				// - bare positional value     → the value as-is
				// Stops at unquoted `{` or `//`.
				let firstArg = "";
				{
					let j = nameEnd;
					// skip whitespace
					while (
						j < trimmed.length &&
						(trimmed[j] === " " || trimmed[j] === "\t")
					) {
						j++;
					}
					// stop immediately at block opener or comment
					if (
						j < trimmed.length &&
						trimmed[j] !== "{" &&
						!(trimmed[j] === "/" && trimmed[j + 1] === "/")
					) {
						// skip type annotation e.g. (u8)
						if (trimmed[j] === "(") {
							while (j < trimmed.length && trimmed[j] !== ")") {
								j++;
							}
							j++; // skip ')'
							while (
								j < trimmed.length &&
								(trimmed[j] === " " || trimmed[j] === "\t")
							) {
								j++;
							}
						}
						const identMatch = trimmed
							.slice(j)
							.match(/^([-\w$.:]+)/);
						if (identMatch) {
							const ident = identMatch[1];
							j += ident.length;
							if (trimmed[j] === "=") {
								j++; // skip '='
								let val = "";
								if (trimmed[j] === '"') {
									// quoted value — strip the quotes
									j++;
									while (
										j < trimmed.length &&
										trimmed[j] !== '"'
									) {
										if (trimmed[j] === "\\") {
											j++;
										}
										if (j < trimmed.length) {
											val += trimmed[j++];
										}
									}
									// skip closing quote
								} else {
									// bare value (number, bool, identifier)
									const valMatch = trimmed
										.slice(j)
										.match(/^[^\s{;\/]+/);
									if (valMatch) {
										val = valMatch[0];
									}
								}
								firstArg = val ? `${ident} ${val}` : ident;
							} else {
								// positional bare value
								firstArg = ident;
							}
						} else if (trimmed[j] === '"') {
							// positional quoted string — strip the quotes
							j++;
							let val = "";
							while (j < trimmed.length && trimmed[j] !== '"') {
								if (trimmed[j] === "\\") {
									j++;
								}
								if (j < trimmed.length) {
									val += trimmed[j++];
								}
							}
							firstArg = val;
						}
					}
				}

				const label = firstArg ? `${nodeName} ${firstArg}` : nodeName;

				// Detect whether this node opens a multi-line children block.
				// A line with `{` but no matching `}` opens a persistent scope.
				const hasBrace = trimmed.includes("{");
				const hasClose = trimmed.includes("}");
				const opensBlock = hasBrace && !hasClose;

				const item: any = {
					label,
					line: i,
					kdlType: "node",
					isRegion: opensBlock,
					children: [],
				};

				if (kdlStack.length > 0) {
					kdlStack[kdlStack.length - 1].children.push(item);
				} else {
					kdlRoot.push(item);
				}

				if (opensBlock) {
					kdlStack.push(item);
				}
			}

			return kdlRoot;
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

			// --- TypeScript / JavaScript Detection ---
			if (isTsJsFile) {
				// Classes: TS only — JS outline is limited to functions, jQuery events, and comments
				if (!isJsFile) {
					const classMatch = text.match(
						/^\s*(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)/,
					);
					if (classMatch) {
						tsJsItems.push({
							label: classMatch[1],
							line: i,
							tsJsType: "class",
							isRegion: false,
							children: [],
						});
						continue;
					}
				}

				const funcMatch = text.match(
					/^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)\s*\(/,
				);
				if (funcMatch) {
					tsJsItems.push({
						label: funcMatch[1] + "()",
						line: i,
						tsJsType: "function",
						isRegion: false,
						children: [],
					});
					continue;
				}

				const arrowMatch = text.match(
					/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/,
				);
				if (arrowMatch) {
					tsJsItems.push({
						label: arrowMatch[1] + "()",
						line: i,
						tsJsType: "arrowFunction",
						isRegion: false,
						children: [],
					});
					continue;
				}

				// jQuery .on() — $("#id").on("event", fn) or $(".cls").on("event", fn)
				const jqOnMatch = text.match(
					/\$\(["']([.#][\w-]+)["']\)\.on\(["'](\w+)["']\s*,\s*function/,
				);

				if (jqOnMatch) {
					const raw = jqOnMatch[1];
					const isId = raw.startsWith("#");
					const name = raw.slice(1);
					const event =
						jqOnMatch[2].charAt(0).toUpperCase() +
						jqOnMatch[2].slice(1);
					tsJsItems.push({
						label: `${name}.${event}`,
						line: i,
						endLine: findJqueryHandlerEnd(document, i),
						tsJsType: "jqueryEvent",
						jquerySelector: isId ? "id" : "class",
						isRegion: false,
						children: [],
					});
					continue;
				}

				// jQuery .delegate() — $(...).delegate(".cls", "event", fn) or $(...).delegate("#id", "event", fn)
				const jqDelegateMatch = text.match(
					/\.delegate\(["']([.#][\w-]+)["']\s*,\s*["'](\w+)["']\s*,\s*function/,
				);

				if (jqDelegateMatch) {
					const raw = jqDelegateMatch[1];
					const isId = raw.startsWith("#");
					const name = raw.slice(1);
					const event =
						jqDelegateMatch[2].charAt(0).toUpperCase() +
						jqDelegateMatch[2].slice(1);
					tsJsItems.push({
						label: `${name}.${event}.Delegate`,
						line: i,
						endLine: findJqueryHandlerEnd(document, i),
						tsJsType: "jqueryEvent",
						jquerySelector: isId ? "id" : "class",
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

			// --- Comment Scanning with String-Safe Logic (O(n) flag-based) ---
			let foundPrefix: string | undefined;
			let prefixIndex = -1;

			let inSingle = false;
			let inDouble = false;
			let hasNonWhitespaceBefore = false;
			for (let charIdx = 0; charIdx < text.length; charIdx++) {
				const ch = text[charIdx];

				// Track closing of open string literals
				if (inDouble) {
					if (ch === "\\") {
						charIdx++;
						continue;
					}
					if (ch === '"') {
						inDouble = false;
					}
					continue;
				}
				if (inSingle) {
					if (ch === "\\") {
						charIdx++;
						continue;
					}
					if (ch === "'") {
						inSingle = false;
					}
					continue;
				}

				// Outside any string: check for a comment prefix
				const currentPrefix = commentPrefixes.find((p) =>
					text.startsWith(p, charIdx),
				);
				if (currentPrefix) {
					// Strict check for SQL ' and # (must start the line)
					if (currentPrefix === "'" || currentPrefix === "#") {
						if (hasNonWhitespaceBefore) {
							// Rejected as comment; ' can still open a string
							if (ch === "'") {
								inSingle = true;
							}
							continue;
						}
						const after = text.substring(charIdx + 1);
						if (
							!triggerChars.some((s) =>
								after.trimStart().startsWith(s),
							) &&
							!after.startsWith(" ")
						) {
							// Rejected as comment; ' can still open a string
							if (ch === "'") {
								inSingle = true;
								hasNonWhitespaceBefore = true;
							}
							continue;
						}
					}
					prefixIndex = charIdx;
					foundPrefix = currentPrefix;
					break;
				}

				// Track string openings and non-whitespace
				if (ch === '"') {
					inDouble = true;
					hasNonWhitespaceBefore = true;
				} else if (ch === "'") {
					inSingle = true;
					hasNonWhitespaceBefore = true;
				} else if (ch !== " " && ch !== "\t") {
					hasNonWhitespaceBefore = true;
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
