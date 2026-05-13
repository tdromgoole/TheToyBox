import * as vscode from "vscode";
import * as crypto from "crypto";

const STORAGE_KEY = "toybox.scratchPad";

function getNonce(): string {
	return crypto.randomBytes(16).toString("hex");
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class ScratchPadProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "scratchPadView";

	private _view?: vscode.WebviewView;

	constructor(private readonly _context: vscode.ExtensionContext) {}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;
		webviewView.webview.options = { enableScripts: true };

		this.refresh();

		webviewView.webview.onDidReceiveMessage((msg) => {
			switch (msg.command) {
				case "save":
					this._context.workspaceState.update(STORAGE_KEY, msg.text);
					break;
				case "saveAsFile":
					this._saveAsFile(msg.text);
					break;
				case "clear":
					this._clear();
					break;
			}
		});

		webviewView.onDidDispose(() => {
			if (this._view === webviewView) {
				this._view = undefined;
			}
		});
	}

	// ─── Public API ─────────────────────────────────────────────────────────

	public refresh(): void {
		if (!this._view) {
			return;
		}
		const enabled = vscode.workspace
			.getConfiguration("theToyBox.scratchPad")
			.get<boolean>("enabled", true);
		if (!enabled) {
			this._view.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; object-src 'none'; style-src 'unsafe-inline';"><style>body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);padding:12px;line-height:1.6;opacity:.8}</style></head><body>Scratch Pad is disabled. Enable it via <code>theToyBox.scratchPad.enabled</code>.</body></html>`;
			return;
		}
		const savedContent = this._context.workspaceState.get<string>(
			STORAGE_KEY,
			"",
		);
		this._view.webview.html = this._buildHtml(savedContent);
	}

	// ─── Private ────────────────────────────────────────────────────────────

	private async _saveAsFile(text: string) {
		const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri
			? vscode.Uri.joinPath(
					vscode.workspace.workspaceFolders[0].uri,
					"scratch.txt",
				)
			: undefined;

		const uri = await vscode.window.showSaveDialog({
			defaultUri,
			filters: {
				"Text files": ["txt", "md"],
				"All files": ["*"],
			},
			saveLabel: "Save Scratch Pad",
		});

		if (!uri) {
			return;
		}

		await vscode.workspace.fs.writeFile(
			uri,
			new TextEncoder().encode(text),
		);
		await vscode.window.showTextDocument(uri);
	}

	private async _clear() {
		const choice = await vscode.window.showWarningMessage(
			"Clear the scratch pad? This cannot be undone.",
			{ modal: true },
			"Clear",
		);
		if (choice !== "Clear") {
			return;
		}
		this._context.workspaceState.update(STORAGE_KEY, "");
		if (this._view) {
			this._view.webview.html = this._buildHtml("");
		}
	}

	private _buildHtml(initialContent: string): string {
		// JSON-encode the content so it round-trips safely into a JS string literal
		const safeContent = JSON.stringify(initialContent);
		const nonce = getNonce();

		return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; object-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);display:flex;flex-direction:column;padding:8px;gap:6px}
.toolbar{display:flex;gap:6px;flex-shrink:0}
button{font-size:11px;background:none;border:1px solid var(--vscode-button-secondaryBackground,#5a5a5a);color:var(--vscode-foreground);padding:2px 8px;border-radius:3px;cursor:pointer}
button:hover{background:var(--vscode-button-secondaryHoverBackground)}
#pad{flex:1;width:100%;resize:none;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;padding:6px;font-family:var(--vscode-editor-font-family,monospace);font-size:var(--vscode-editor-font-size,13px);line-height:1.5;outline:none;tab-size:4}
#pad:focus{border-color:var(--vscode-focusBorder)}
#status{font-size:10px;opacity:.5;flex-shrink:0;height:14px}
</style></head><body>
<div class="toolbar">
  <button onclick="saveAsFile()">Save as File…</button>
  <button onclick="clearPad()">Clear</button>
</div>
<textarea id="pad" spellcheck="false" placeholder="Scratch pad — notes are saved automatically per workspace."></textarea>
<div id="status"></div>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
const pad=document.getElementById('pad');
const status=document.getElementById('status');
let statusTimer;

pad.value=${safeContent};

pad.addEventListener('input',()=>{
  vscode.postMessage({command:'save',text:pad.value});
  status.textContent='Saved';
  clearTimeout(statusTimer);
  statusTimer=setTimeout(()=>{status.textContent='';},1500);
});

// Flush on panel hide (covers collapsing the sidebar before the next tick)
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){vscode.postMessage({command:'save',text:pad.value});}
});

function saveAsFile(){vscode.postMessage({command:'saveAsFile',text:pad.value});}
function clearPad(){vscode.postMessage({command:'clear'});}

// Keep tab key working as indentation instead of focus-shifting
pad.addEventListener('keydown',e=>{
  if(e.key==='Tab'){
    e.preventDefault();
    const s=pad.selectionStart,end=pad.selectionEnd;
    pad.value=pad.value.substring(0,s)+'\t'+pad.value.substring(end);
    pad.selectionStart=pad.selectionEnd=s+1;
  }
});
</script></body></html>`;
	}
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerScratchPad(
	context: vscode.ExtensionContext,
): ScratchPadProvider {
	const provider = new ScratchPadProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ScratchPadProvider.viewType,
			provider,
			{ webviewOptions: { retainContextWhenHidden: true } },
		),
	);
	return provider;
}
