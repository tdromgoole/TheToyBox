import * as vscode from "vscode";

export class WordFrequencyProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wordFrequencyView";

	private _view?: vscode.WebviewView;
	private _updateTimeout?: NodeJS.Timeout;

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;
		webviewView.webview.options = { enableScripts: true };

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage((msg) => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			if (msg.command === "goTo" && typeof msg.line === "number") {
				// Navigate to a specific 1-based line number
				const pos = new vscode.Position(msg.line - 1, 0);
				editor.selection = new vscode.Selection(pos, pos);
				editor.revealRange(
					new vscode.Range(pos, pos),
					vscode.TextEditorRevealType.InCenterIfOutsideViewport,
				);
				vscode.window.showTextDocument(editor.document, {
					viewColumn: editor.viewColumn,
				});
			}
		});

		const viewDisposables: vscode.Disposable[] = [];
		viewDisposables.push(
			vscode.window.onDidChangeActiveTextEditor(() =>
				this._scheduleUpdate(),
			),
			vscode.workspace.onDidChangeTextDocument((e) => {
				if (e.document === vscode.window.activeTextEditor?.document) {
					this._scheduleUpdate();
				}
			}),
		);

		webviewView.onDidDispose(() => {
			viewDisposables.forEach((d) => d.dispose());
			if (this._updateTimeout) {
				clearTimeout(this._updateTimeout);
				this._updateTimeout = undefined;
			}
			if (this._view === webviewView) {
				this._view = undefined;
			}
		});

		this._scheduleUpdate();
	}

	private _scheduleUpdate() {
		if (!this._view?.visible) {
			return;
		}
		if (this._updateTimeout) {
			clearTimeout(this._updateTimeout);
		}
		this._updateTimeout = setTimeout(() => {
			this._refresh();
		}, 400);
	}

	public refresh() {
		this._refresh();
	}

	private _refresh() {
		if (!this._view) {
			return;
		}
		const enabled = vscode.workspace
			.getConfiguration("theToyBox.wordFrequency")
			.get<boolean>("enabled", true);
		if (!enabled) {
			this._view.webview.html = this._emptyHtml(
				"Word Frequency is disabled. Enable it via <code>theToyBox.wordFrequency.enabled</code>.",
			);
			return;
		}
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			this._view.webview.html = this._emptyHtml("No active file open.");
			return;
		}
		const freq = this._countTokens(editor.document.getText());
		const label = vscode.workspace.asRelativePath(editor.document.uri);
		this._view.webview.html = this._buildHtml(freq, label);
	}

	private _countTokens(
		text: string,
	): Array<{ word: string; count: number; lines: number[] }> {
		const countMap = new Map<string, number>();
		const linesMap = new Map<string, Set<number>>();
		const re = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
		const rawLines = text.split("\n");
		for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
			re.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = re.exec(rawLines[lineIdx])) !== null) {
				const word = m[0];
				if (word.length < 2) {
					continue;
				}
				countMap.set(word, (countMap.get(word) ?? 0) + 1);
				if (!linesMap.has(word)) {
					linesMap.set(word, new Set());
				}
				linesMap.get(word)!.add(lineIdx + 1); // 1-based
			}
		}
		return [...countMap.entries()]
			.map(([word, count]) => ({
				word,
				count,
				lines: [...linesMap.get(word)!],
			}))
			.sort((a, b) => b.count - a.count);
	}

	private _emptyHtml(msg: string): string {
		return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         background: var(--vscode-sideBar-background); padding: 12px; }
</style>
</head>
<body><p>${msg}</p></body></html>`;
	}

	private _buildHtml(
		freq: Array<{ word: string; count: number; lines: number[] }>,
		fileName: string,
	): string {
		const maxCount = freq[0]?.count ?? 1;
		const shown = freq.slice(0, 500);
		const MAX_CHIPS = 200;

		const rows = shown
			.map(({ word, count, lines }, idx) => {
				const pct = Math.max(2, Math.round((count / maxCount) * 100));
				const safeWord = word
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;")
					.replace(/"/g, "&quot;");
				const linesJson = JSON.stringify(
					lines.slice(0, MAX_CHIPS),
				).replace(/"/g, "&quot;");
				const extraNote =
					lines.length > MAX_CHIPS
						? `<span class="extra-note">+ ${lines.length - MAX_CHIPS} more</span>`
						: "";
				const uniqueLines = lines.length;
				return `<tr class="word-row" data-word="${safeWord}" data-lines="${linesJson}">
  <td class="toggle">&#9654;</td>
  <td class="word">${safeWord}</td>
  <td class="bar"><div style="width:${pct}%"></div></td>
  <td class="count">${count}</td>
</tr>
<tr class="lines-row hidden" data-for="${safeWord}">
  <td colspan="4">
    <div class="line-chips" id="chips-${idx}">${extraNote}</div>
    <div class="line-meta">${uniqueLines} line${uniqueLines !== 1 ? "s" : ""}</div>
  </td>
</tr>`;
			})
			.join("\n");

		const safeFile = fileName
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");

		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 8px;
  }
  .file-label {
    font-size: 11px;
    opacity: 0.65;
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
  }
  #search:focus { border-color: var(--vscode-focusBorder); }
  table { width: 100%; border-collapse: collapse; }
  .word-row { cursor: pointer; }
  .word-row:hover td { background: var(--vscode-list-hoverBackground); }
  td { padding: 2px 4px; vertical-align: middle; }
  .toggle {
    font-size: 9px;
    width: 16px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    display: inline-block;
    transition: transform 0.12s;
  }
  .word-row.expanded .toggle { transform: rotate(90deg); }
  .word { font-family: var(--vscode-editor-font-family, monospace); white-space: nowrap; }
  .bar { width: 60px; padding: 2px 6px; }
  .bar div { height: 7px; background: var(--vscode-progressBar-background, #0078d4); border-radius: 2px; min-width: 2px; }
  .count {
    color: var(--vscode-badge-foreground);
    background: var(--vscode-badge-background);
    font-size: 10px;
    border-radius: 10px;
    padding: 1px 6px;
    text-align: center;
    white-space: nowrap;
    min-width: 22px;
    display: inline-block;
  }
  .lines-row td {
    padding: 4px 8px 8px 24px;
    background: var(--vscode-sideBar-background);
  }
  .line-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
  .chip {
    cursor: pointer;
    font-size: 11px;
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--vscode-editor-foreground);
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, var(--vscode-focusBorder));
    border-radius: 3px;
    padding: 2px 7px;
    line-height: 1.4;
  }
  .chip:hover {
    background: var(--vscode-list-hoverBackground);
    border-color: var(--vscode-focusBorder);
    color: var(--vscode-textLink-activeForeground, var(--vscode-editor-foreground));
  }
  .extra-note { font-size: 10px; opacity: 0.6; align-self: center; }
  .line-meta { font-size: 10px; opacity: 0.55; }
  .hidden { display: none; }
  .summary { font-size: 11px; opacity: 0.6; margin-top: 8px; }
</style>
</head>
<body>
<div class="file-label" title="${safeFile}">${safeFile}</div>
<input id="search" type="text" placeholder="Filter tokens\u2026" autocomplete="off" spellcheck="false" />
<table id="freq-table">
<tbody>
${rows}
</tbody>
</table>
<div class="summary">${freq.length} unique tokens${freq.length > 500 ? " &mdash; showing top 500" : ""}</div>
<script>
  const vscode = acquireVsCodeApi();

  function buildChips(linesRow, linesData) {
    const container = linesRow.querySelector('.line-chips');
    if (container.dataset.built) return;
    container.dataset.built = '1';
    linesData.forEach(lineNum => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = lineNum;
      chip.dataset.line = lineNum;
      chip.addEventListener('click', e => {
        e.stopPropagation();
        vscode.postMessage({ command: 'goTo', line: lineNum });
      });
      container.appendChild(chip);
    });
  }

  document.querySelectorAll('tr.word-row').forEach(row => {
    row.addEventListener('click', () => {
      const linesRow = row.nextElementSibling;
      if (!linesRow || !linesRow.classList.contains('lines-row')) return;
      const isOpen = !linesRow.classList.contains('hidden');
      if (!isOpen) {
        const linesData = JSON.parse(row.dataset.lines || '[]');
        buildChips(linesRow, linesData);
      }
      linesRow.classList.toggle('hidden');
      row.classList.toggle('expanded');
    });
  });

  document.getElementById('search').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('tr.word-row').forEach(row => {
      const hide = q.length > 0 && !row.dataset.word.toLowerCase().includes(q);
      row.classList.toggle('hidden', hide);
      const linesRow = row.nextElementSibling;
      if (linesRow && linesRow.classList.contains('lines-row')) {
        if (hide) {
          linesRow.classList.add('hidden');
        } else if (!row.classList.contains('expanded')) {
          linesRow.classList.add('hidden');
        }
      }
    });
  });
</script>
</body>
</html>`;
	}
}

export function registerWordFrequency(context: vscode.ExtensionContext) {
	const provider = new WordFrequencyProvider();

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			WordFrequencyProvider.viewType,
			provider,
		),
		vscode.commands.registerCommand("wordFrequency.refresh", () => {
			provider.refresh();
		}),
	);
}
