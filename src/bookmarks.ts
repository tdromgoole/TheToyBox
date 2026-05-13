import * as vscode from "vscode";
import * as crypto from "crypto";

interface Bookmark {
	uri: string;
	line: number; // 0-based
	label: string;
}

const STORAGE_KEY = "toybox.bookmarks";
let _decorationType: vscode.TextEditorDecorationType | undefined;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNonce(): string {
	return crypto.randomBytes(16).toString("hex");
}

function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function emptyHtml(msg: string): string {
	const nonce = getNonce();
	return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; object-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);padding:12px;line-height:1.6;opacity:.8}</style>
</head><body>${msg}</body></html>`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class BookmarksProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "bookmarksView";
	private _view?: vscode.WebviewView;

	constructor(private readonly _context: vscode.ExtensionContext) {}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._context.extensionUri],
		};

		webviewView.webview.onDidReceiveMessage((msg) => {
			switch (msg.command) {
				case "goTo":
					this._jumpTo(msg.uri, msg.line);
					break;
				case "remove":
					this._remove(msg.uri, msg.line);
					break;
				case "clearAll":
					this._clearAll();
					break;
			}
		});

		webviewView.onDidDispose(() => {
			if (this._view === webviewView) {
				this._view = undefined;
			}
		});

		this._refresh();
	}

	// ─── Public API ─────────────────────────────────────────────────────────

	public toggle() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const line = editor.selection.active.line;
		const uri = editor.document.uri.toString();
		const bookmarks = this._load();
		const idx = bookmarks.findIndex(
			(b) => b.uri === uri && b.line === line,
		);
		if (idx >= 0) {
			bookmarks.splice(idx, 1);
		} else {
			const label = editor.document
				.lineAt(line)
				.text.trim()
				.slice(0, 100);
			bookmarks.push({ uri, line, label });
		}
		this._save(bookmarks);
		this._refresh();
		updateBookmarkDecorations(this._context);
	}

	public nextBookmark() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const bookmarks = this._load();
		const uri = editor.document.uri.toString();
		const inFile = bookmarks
			.filter((b) => b.uri === uri)
			.sort((a, b) => a.line - b.line);
		if (inFile.length === 0) {
			vscode.window.showInformationMessage(
				"The Toy Box: No bookmarks in this file.",
			);
			return;
		}
		const cur = editor.selection.active.line;
		const next = inFile.find((b) => b.line > cur) ?? inFile[0];
		this._jumpTo(next.uri, next.line);
	}

	public previousBookmark() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const bookmarks = this._load();
		const uri = editor.document.uri.toString();
		const inFile = bookmarks
			.filter((b) => b.uri === uri)
			.sort((a, b) => a.line - b.line);
		if (inFile.length === 0) {
			vscode.window.showInformationMessage(
				"The Toy Box: No bookmarks in this file.",
			);
			return;
		}
		const cur = editor.selection.active.line;
		const prev =
			[...inFile].reverse().find((b) => b.line < cur) ??
			inFile[inFile.length - 1];
		this._jumpTo(prev.uri, prev.line);
	}

	// ─── Private ────────────────────────────────────────────────────────────

	private async _jumpTo(uri: string, line: number) {
		const doc = await vscode.workspace.openTextDocument(
			vscode.Uri.parse(uri),
		);
		const editor = await vscode.window.showTextDocument(doc);
		const pos = new vscode.Position(line, 0);
		editor.selection = new vscode.Selection(pos, pos);
		editor.revealRange(
			new vscode.Range(pos, pos),
			vscode.TextEditorRevealType.InCenterIfOutsideViewport,
		);
	}

	private _remove(uri: string, line: number) {
		this._save(
			this._load().filter((b) => !(b.uri === uri && b.line === line)),
		);
		this._refresh();
		updateBookmarkDecorations(this._context);
	}

	private async _clearAll() {
		const choice = await vscode.window.showWarningMessage(
			"Clear all bookmarks?",
			{ modal: true },
			"Clear All",
		);
		if (choice === "Clear All") {
			this._save([]);
			this._refresh();
			updateBookmarkDecorations(this._context);
		}
	}

	private _load(): Bookmark[] {
		return this._context.workspaceState.get<Bookmark[]>(STORAGE_KEY, []);
	}

	private _save(bookmarks: Bookmark[]) {
		this._context.workspaceState.update(STORAGE_KEY, bookmarks);
	}

	public refresh(): void {
		this._refresh();
	}

	private _refresh() {
		if (!this._view) {
			return;
		}
		const enabled = vscode.workspace
			.getConfiguration("theToyBox.bookmarks")
			.get<boolean>("enabled", true);
		if (!enabled) {
			this._view.webview.html = emptyHtml(
				"Bookmarks is disabled. Enable it via <code>theToyBox.bookmarks.enabled</code>.",
			);
			return;
		}
		this._view.webview.html = this._buildHtml(this._load());
	}

	private _buildHtml(bookmarks: Bookmark[]): string {
		if (bookmarks.length === 0) {
			return emptyHtml(
				"No bookmarks yet.<br><br>Press <strong>Ctrl+Shift+Alt+B</strong> to bookmark the current line.",
			);
		}

		// Group by file, preserving insertion order of first occurrence
		const byFile = new Map<string, Bookmark[]>();
		for (const b of bookmarks) {
			if (!byFile.has(b.uri)) {
				byFile.set(b.uri, []);
			}
			byFile.get(b.uri)!.push(b);
		}

		const groups = [...byFile.entries()]
			.map(([uri, items]) => {
				const relPath = vscode.workspace.asRelativePath(
					vscode.Uri.parse(uri),
				);
				const safeRel = esc(relPath);
				const rows = items
					.sort((a, b) => a.line - b.line)
					.map((b) => {
						const safeLabel = esc(b.label);
						const safeUri = encodeURIComponent(b.uri);
						return `<div class="bm-row" onclick="goTo('${safeUri}',${b.line})">
  <span class="ln">L${b.line + 1}</span>
  <span class="lbl">${safeLabel || "<em>blank line</em>"}</span>
  <button class="rm" onclick="event.stopPropagation();rm('${safeUri}',${b.line})" title="Remove"><span class="material-symbols-outlined">close</span></button>
</div>`;
					})
					.join("");
				return `<div class="grp"><div class="fh" title="${safeRel}">${safeRel}</div>${rows}</div>`;
			})
			.join("");

		const total = bookmarks.length;
		const nonce = getNonce();
		const fontUri = this._view!.webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._context.extensionUri,
				"fonts",
				"MaterialSymbolsOutlined.woff2",
			),
		);
		const cspSource = this._view!.webview.cspSource;

		return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; object-src 'none'; font-src ${cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:400;src:url('${fontUri}')format('woff2');}
.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:16px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);padding:8px}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.cnt{font-size:11px;opacity:.65}
.clr{font-size:11px;background:none;border:1px solid var(--vscode-button-secondaryBackground,#5a5a5a);color:var(--vscode-foreground);padding:2px 8px;border-radius:3px;cursor:pointer}
.clr:hover{background:var(--vscode-button-secondaryHoverBackground)}
.grp{margin-bottom:10px}
.fh{font-size:11px;opacity:.7;padding:2px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.bm-row{display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:3px;cursor:pointer;min-width:0}
.bm-row:hover{background:var(--vscode-list-hoverBackground)}
.ln{font-family:monospace;font-size:11px;opacity:.5;min-width:34px;flex-shrink:0}
.lbl{flex:1;font-family:var(--vscode-editor-font-family,monospace);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rm{background:none;border:none;color:var(--vscode-foreground);opacity:.35;cursor:pointer;padding:0 2px;flex-shrink:0;line-height:1;display:flex;align-items:center}
.rm:hover{opacity:1;color:var(--vscode-errorForeground)}
.rm .material-symbols-outlined{font-size:16px}
</style></head><body>
<div class="toolbar"><span class="cnt">${total} bookmark${total !== 1 ? "s" : ""}</span><button class="clr" onclick="clearAll()">Clear All</button></div>
${groups}
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
function goTo(u,l){vscode.postMessage({command:'goTo',uri:decodeURIComponent(u),line:l});}
function rm(u,l){vscode.postMessage({command:'remove',uri:decodeURIComponent(u),line:l});}
function clearAll(){vscode.postMessage({command:'clearAll'});}
</script></body></html>`;
	}
}

// ─── Editor Decorations ───────────────────────────────────────────────────────

export function updateBookmarkDecorations(context: vscode.ExtensionContext) {
	const editor = vscode.window.activeTextEditor;
	if (!editor || !_decorationType) {
		return;
	}
	const bookmarks = context.workspaceState.get<Bookmark[]>(STORAGE_KEY, []);
	const uri = editor.document.uri.toString();
	const ranges = bookmarks
		.filter((b) => b.uri === uri)
		.map((b) => {
			const ln = Math.min(b.line, editor.document.lineCount - 1);
			return editor.document.lineAt(ln).range;
		});
	editor.setDecorations(_decorationType, ranges);
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerBookmarks(
	context: vscode.ExtensionContext,
): BookmarksProvider {
	_decorationType = vscode.window.createTextEditorDecorationType({
		overviewRulerColor: new vscode.ThemeColor("minimap.findMatchHighlight"),
		overviewRulerLane: vscode.OverviewRulerLane.Left,
	});
	context.subscriptions.push(_decorationType);

	const provider = new BookmarksProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			BookmarksProvider.viewType,
			provider,
		),
		vscode.commands.registerCommand("theToyBox.toggleBookmark", () =>
			provider.toggle(),
		),
		vscode.commands.registerCommand("theToyBox.nextBookmark", () =>
			provider.nextBookmark(),
		),
		vscode.commands.registerCommand("theToyBox.previousBookmark", () =>
			provider.previousBookmark(),
		),
	);
	return provider;
}
