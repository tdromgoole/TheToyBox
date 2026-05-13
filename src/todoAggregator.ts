import * as vscode from "vscode";
import * as crypto from "crypto";

interface TodoItem {
	uri: string;
	line: number; // 0-based
	lineText: string;
	marker: string;
	label: string;
	color: string;
}

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

const COMMENT_PREFIXES = ["//", "/*", "*", "--", "#", "%", ";", "'"];

function buildScanRegex(markers: string[]): RegExp {
	const escapedPrefixes = COMMENT_PREFIXES.map((p) =>
		p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
	).join("|");
	const escapedMarkers = markers
		.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("|");
	return new RegExp(
		`(?:${escapedPrefixes})\\s*(${escapedMarkers})(?:\\s+(.*))?$`,
	);
}

function scanText(
	text: string,
	uriStr: string,
	re: RegExp,
	colors: Record<string, string>,
	labels: Record<string, string>,
): TodoItem[] {
	const items: TodoItem[] = [];
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const m = re.exec(lines[i]);
		if (m) {
			const marker = m[1];
			items.push({
				uri: uriStr,
				line: i,
				lineText: (m[2] ?? "").trim(),
				marker,
				label: labels[marker] ?? marker,
				color: colors[marker] ?? "#888888",
			});
		}
	}
	return items;
}

const CACHE_KEY = "toybox.todoCache";

// ─── Provider ─────────────────────────────────────────────────────────────────

export class TodoAggregatorProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "todoAggregatorView";

	private _view?: vscode.WebviewView;
	private _items: TodoItem[] = [];
	private _scanning = false;
	private _lastScanned?: Date;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _context: vscode.ExtensionContext,
	) {
		const cached = _context.workspaceState.get<{
			items: TodoItem[];
			scannedAt: string;
		}>(CACHE_KEY);
		if (cached) {
			this._items = cached.items;
			this._lastScanned = new Date(cached.scannedAt);
		}
	}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.onDidReceiveMessage(async (msg) => {
			if (msg.command === "refresh") {
				await this.scan();
			} else if (msg.command === "goTo") {
				await this._jumpTo(msg.uri, msg.line);
			}
		});

		webviewView.onDidChangeVisibility(() => {
			if (
				webviewView.visible &&
				this._items.length === 0 &&
				!this._scanning
			) {
				this.scan();
			}
		});

		webviewView.onDidDispose(() => {
			if (this._view === webviewView) {
				this._view = undefined;
			}
		});

		this._render();
	}

	// ─── Public API ─────────────────────────────────────────────────────────

	public async scan() {
		const enabled = vscode.workspace
			.getConfiguration("theToyBox.todoAggregator")
			.get<boolean>("enabled", true);
		if (!enabled || this._scanning) {
			return;
		}
		this._scanning = true;
		this._render();

		try {
			const cfg = vscode.workspace.getConfiguration(
				"theToyBox.customComments",
			);
			const colors = cfg.get<Record<string, string>>("colors", {});
			const labels = cfg.get<Record<string, string>>("labels", {});
			const markers = Object.keys(colors);

			if (markers.length === 0) {
				this._items = [];
				this._lastScanned = new Date();
				return;
			}

			const aggCfg = vscode.workspace.getConfiguration(
				"theToyBox.todoAggregator",
			);
			const excludeRaw = aggCfg.get<string>(
				"exclude",
				"**/node_modules/**,**/dist/**,**/.git/**,**/out/**",
			);
			const globs = excludeRaw
				.split(",")
				.map((g) => g.trim())
				.filter(Boolean);
			const excludePattern =
				globs.length > 0 ? `{${globs.join(",")}}` : undefined;

			const files = await vscode.workspace.findFiles(
				"**/*",
				excludePattern,
				5000,
			);
			const re = buildScanRegex(markers);
			const collected: TodoItem[] = [];

			for (const file of files) {
				try {
					const bytes = await vscode.workspace.fs.readFile(file);
					const text = new TextDecoder("utf-8").decode(bytes);
					// Skip binary files (null bytes present)
					if (text.includes("\0")) {
						continue;
					}
					const found = scanText(
						text,
						file.toString(),
						re,
						colors,
						labels,
					);
					collected.push(...found);
				} catch {
					// Unreadable file — skip silently
				}
			}

			this._items = collected;
			this._lastScanned = new Date();
			this._context.workspaceState.update(CACHE_KEY, {
				items: this._items,
				scannedAt: this._lastScanned.toISOString(),
			});
		} finally {
			this._scanning = false;
			this._render();
		}
	}

	/** Incremental update — call this on file save to avoid a full rescan. */
	public updateFile(uri: vscode.Uri, text: string) {
		const uriStr = uri.toString();
		this._items = this._items.filter((i) => i.uri !== uriStr);

		const cfg = vscode.workspace.getConfiguration(
			"theToyBox.customComments",
		);
		const colors = cfg.get<Record<string, string>>("colors", {});
		const labels = cfg.get<Record<string, string>>("labels", {});
		const markers = Object.keys(colors);

		if (markers.length > 0) {
			const re = buildScanRegex(markers);
			this._items.push(...scanText(uriStr, text, re, colors, labels));
		}

		this._render();
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

	public refresh(): void {
		this._render();
	}

	private _render() {
		if (!this._view) {
			return;
		}
		const enabled = vscode.workspace
			.getConfiguration("theToyBox.todoAggregator")
			.get<boolean>("enabled", true);
		if (!enabled) {
			this._view.webview.html = this._statusHtml(
				"Tagged Comments scan is disabled. Enable it via <code>theToyBox.todoAggregator.enabled</code>.",
			);
			return;
		}
		this._view.webview.html = this._buildHtml();
	}

	private _buildHtml(): string {
		if (this._scanning) {
			return this._statusHtml("Scanning workspace…");
		}

		if (this._items.length === 0 && !this._lastScanned) {
			return this._statusHtml(
				"Click <strong>Refresh</strong> to scan the workspace for tagged comments.",
				true,
			);
		}

		if (this._items.length === 0) {
			return this._statusHtml(
				"No tagged comments found in the workspace.",
				true,
			);
		}

		// Collect unique markers in first-seen order
		const uniqueMarkers = [
			...new Map(
				this._items.map((item) => [
					item.marker,
					{
						marker: item.marker,
						label: item.label,
						color: item.color,
					},
				]),
			).values(),
		];

		// Group by file
		const byFile = new Map<string, TodoItem[]>();
		for (const item of this._items) {
			if (!byFile.has(item.uri)) {
				byFile.set(item.uri, []);
			}
			byFile.get(item.uri)!.push(item);
		}

		const groups = [...byFile.entries()]
			.map(([uri, items]) => {
				const relPath = vscode.workspace.asRelativePath(
					vscode.Uri.parse(uri),
				);
				const safeRel = esc(relPath);
				const rows = items
					.sort((a, b) => a.line - b.line)
					.map((item) => {
						const safeText = esc(item.lineText);
						const safeUri = esc(item.uri);
						const safeMarker = esc(item.marker);
						const badgeStyle = `background:${item.color}22;color:${item.color};border:1px solid ${item.color}55`;
						return `<div class="todo-row" data-marker="${safeMarker}" data-uri="${safeUri}" data-line="${item.line}">
  <span class="ln">L${item.line + 1}</span>
  <span class="badge" style="${badgeStyle}">${esc(item.label)}</span>
  <span class="txt">${safeText || "<em>no text</em>"}</span>
</div>`;
					})
					.join("");

				return `<div class="grp">
  <div class="fh" title="${safeRel}">${safeRel} <span class="fc">(${items.length})</span></div>
  ${rows}
</div>`;
			})
			.join("");

		const total = this._items.length;
		const fileCount = byFile.size;
		const scannedAt = this._lastScanned
			? this._lastScanned.toLocaleTimeString()
			: "";
		const nonce = getNonce();
		const fontUri = this._view!.webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._extensionUri,
				"fonts",
				"MaterialSymbolsOutlined.woff2",
			),
		);
		const cspSource = this._view!.webview.cspSource;

		const filterButtons = uniqueMarkers
			.map(({ marker, label, color }) => {
				const style = `background:${color}22;color:${color};border:1px solid ${color}55`;
				return `<button class="filter-btn" data-marker="${esc(marker)}" style="${style}">${esc(label)}</button>`;
			})
			.join("");

		return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; object-src 'none'; font-src ${cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:400;src:url('${fontUri}')format('woff2');}
.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:16px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);padding:8px}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px}
.meta{font-size:11px;opacity:.65;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.refresh-btn{font-size:11px;background:none;border:1px solid var(--vscode-button-secondaryBackground,#5a5a5a);color:var(--vscode-foreground);padding:2px 8px;border-radius:3px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;gap:4px}
.refresh-btn .material-symbols-outlined{font-size:14px}
.refresh-btn:hover{background:var(--vscode-button-secondaryHoverBackground)}
.filter-bar{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.filter-btn{font-size:10px;padding:2px 8px;border-radius:10px;cursor:pointer;font-weight:600;white-space:nowrap;transition:opacity .15s}
.filter-btn.inactive{opacity:.28}
.grp{margin-bottom:10px}
.grp.all-hidden{display:none}
.fh{font-size:11px;opacity:.7;padding:2px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.fc{font-weight:normal;opacity:.6}
.todo-row{display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:3px;cursor:pointer;min-width:0}
.todo-row:hover{background:var(--vscode-list-hoverBackground)}
.todo-row.hidden-by-filter{display:none}
.ln{font-family:monospace;font-size:11px;opacity:.5;min-width:34px;flex-shrink:0}
.badge{font-size:10px;padding:1px 5px;border-radius:3px;flex-shrink:0;font-weight:600;white-space:nowrap}
.txt{flex:1;font-family:var(--vscode-editor-font-family,monospace);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#no-results{display:none;font-size:12px;opacity:.7;padding:12px 4px}
</style></head><body>
<div class="toolbar">
  <span class="meta" id="meta">${total} item${total !== 1 ? "s" : ""} in ${fileCount} file${fileCount !== 1 ? "s" : ""} · ${scannedAt}</span>
  <button class="refresh-btn" id="btn-refresh"><span class="material-symbols-outlined">sync</span>Refresh</button>
</div>
<div class="filter-bar">${filterButtons}</div>
${groups}
<div id="no-results">No items match the current filter.</div>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
const TOTAL=${total},FILE_COUNT=${fileCount},SCANNED_AT=${JSON.stringify(scannedAt)};
const saved=vscode.getState();
const hiddenMarkers=new Set(saved!=null?(saved.hidden||[]):['*']);

function applyFilter(){
  let visItems=0;
  document.querySelectorAll('.todo-row').forEach(function(r){
    const hide=hiddenMarkers.has(r.dataset.marker);
    r.classList.toggle('hidden-by-filter',hide);
    if(!hide)visItems++;
  });
  let visFiles=0;
  document.querySelectorAll('.grp').forEach(function(g){
    const any=Array.from(g.querySelectorAll('.todo-row')).some(function(r){return !r.classList.contains('hidden-by-filter');});
    g.classList.toggle('all-hidden',!any);
    if(any)visFiles++;
  });
  document.querySelectorAll('.filter-btn').forEach(function(b){
    b.classList.toggle('inactive',hiddenMarkers.has(b.dataset.marker));
  });
  document.getElementById('no-results').style.display=visItems===0?'block':'none';
  const filtered=hiddenMarkers.size>0;
  const itemStr=filtered?(visItems+'/'+TOTAL+' items'):(TOTAL+' item'+(TOTAL!==1?'s':''));
  const fileStr=filtered?(visFiles+'/'+FILE_COUNT+' files'):(FILE_COUNT+' file'+(FILE_COUNT!==1?'s':''));
  document.getElementById('meta').textContent=itemStr+' in '+fileStr+(SCANNED_AT?' \u00b7 '+SCANNED_AT:'');
}

document.getElementById('btn-refresh').addEventListener('click',function(){
  vscode.postMessage({command:'refresh'});
});

document.querySelectorAll('.filter-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    const marker=btn.dataset.marker;
    if(hiddenMarkers.has(marker)){hiddenMarkers.delete(marker);}else{hiddenMarkers.add(marker);}
    vscode.setState({hidden:Array.from(hiddenMarkers)});
    applyFilter();
  });
});

document.querySelectorAll('.todo-row').forEach(function(row){
  row.addEventListener('click',function(){
    vscode.postMessage({command:'goTo',uri:row.dataset.uri,line:parseInt(row.dataset.line,10)});
  });
});

applyFilter();
</script></body></html>`;
	}

	private _statusHtml(msg: string, showRefresh = false): string {
		const nonce = getNonce();
		const fontUri = this._view!.webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._extensionUri,
				"fonts",
				"MaterialSymbolsOutlined.woff2",
			),
		);
		const cspSource = this._view!.webview.cspSource;
		const btn = showRefresh
			? `<br><br><button id="btn-refresh" style="font-size:12px;background:none;border:1px solid var(--vscode-button-secondaryBackground,#5a5a5a);color:var(--vscode-foreground);padding:4px 12px;border-radius:3px;cursor:pointer;display:inline-flex;align-items:center;gap:4px"><span class="material-symbols-outlined" style="font-size:14px">sync</span>Refresh</button>`
			: "";
		const refreshScript = showRefresh
			? `var b=document.getElementById('btn-refresh');if(b){b.addEventListener('click',function(){vscode.postMessage({command:'refresh'});});}`
			: "";
		return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; object-src 'none'; font-src ${cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"><style>@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:400;src:url('${fontUri}')format('woff2');}.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:16px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased}body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);padding:12px;line-height:1.6;opacity:.8}</style></head><body>${msg}${btn}<script nonce="${nonce}">const vscode=acquireVsCodeApi();${refreshScript}</script></body></html>`;
	}
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerTodoAggregator(
	context: vscode.ExtensionContext,
): TodoAggregatorProvider {
	const provider = new TodoAggregatorProvider(context.extensionUri, context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			TodoAggregatorProvider.viewType,
			provider,
		),
		vscode.commands.registerCommand(
			"theToyBox.scanTodos",
			async () => await provider.scan(),
		),
		// Incremental update on save
		vscode.workspace.onDidSaveTextDocument((doc) => {
			provider.updateFile(doc.uri, doc.getText());
		}),
	);

	return provider;
}
