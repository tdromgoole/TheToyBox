import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { randomBytes } from "crypto";

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function generateNonce(): string {
	return randomBytes(16).toString("base64");
}

function buildPrintHtml(
	fileName: string,
	languageId: string,
	content: string,
): string {
	const nonce = generateNonce();
	const lines = content.split("\n");
	const lineCount = lines.length;
	const lineNumWidth = String(lineCount).length;

	const numberedLines = lines
		.map((line, i) => {
			const lineNum = String(i + 1).padStart(lineNumWidth, " ");
			return `<div class="line"><span class="ln">${escapeHtml(lineNum)}</span><span class="lc">${escapeHtml(line)}</span></div>`;
		})
		.join("");

	const date = new Date().toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; object-src 'none'; frame-ancestors 'none';">
<title>${escapeHtml(fileName)}</title>
<style nonce="${nonce}">
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10pt;
    color: #000;
    background: #fff;
    padding: 12px 16px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-bottom: 6px;
    border-bottom: 1px solid #888;
    margin-bottom: 10px;
  }
  .hdr-name { font-weight: bold; font-size: 11pt; }
  .hdr-meta { color: #555; font-size: 9pt; }
  .code-body {
    font-family: inherit;
    font-size: inherit;
  }
  .line {
    display: flex;
    line-height: 1.5;
    min-height: 1.5em;
  }
  .ln {
    flex-shrink: 0;
    color: #aaa;
    border-right: 1px solid #ddd;
    padding-right: 10px;
    margin-right: 10px;
    min-width: ${lineNumWidth + 1}ch;
    text-align: right;
    user-select: none;
    -webkit-user-select: none;
  }
  .lc {
    flex: 1;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  @media print {
    @page { margin: 1.5cm; }
    body { font-size: 9pt; padding: 0; }
    .ln { color: #bbb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<header>
  <span class="hdr-name">${escapeHtml(fileName)}</span>
  <span class="hdr-meta">${escapeHtml(languageId)} &bull; ${lineCount} lines &bull; ${escapeHtml(date)}</span>
</header>
<div class="code-body">${numberedLines}</div>
<script nonce="${nonce}">
  window.addEventListener('load', function () { window.print(); });
</script>
</body>
</html>`;
}

async function openAndPrint(
	_context: vscode.ExtensionContext,
	uri?: vscode.Uri,
): Promise<void> {
	let document: vscode.TextDocument | undefined;

	if (uri) {
		try {
			document = await vscode.workspace.openTextDocument(uri);
		} catch {
			vscode.window.showWarningMessage(
				"The Toy Box: Could not open file for printing.",
			);
			return;
		}
	} else {
		document = vscode.window.activeTextEditor?.document;
	}

	const enabled = vscode.workspace
		.getConfiguration("theToyBox.print")
		.get<boolean>("enabled", true);
	if (!enabled) {
		vscode.window.showInformationMessage(
			'The Toy Box: Printing is disabled. Enable it in Settings under "Toy Box › Print: Enabled".',
		);
		return;
	}

	if (!document) {
		vscode.window.showWarningMessage("The Toy Box: No file to print.");
		return;
	}

	const fileName = document.fileName
		? path.basename(document.fileName)
		: "Untitled";
	const languageId = document.languageId;
	const content = document.getText();

	const html = buildPrintHtml(fileName, languageId, content);
	const tmpFile = path.join(os.tmpdir(), `toybox-print-${Date.now()}.html`);

	try {
		fs.writeFileSync(tmpFile, html, "utf8");
	} catch {
		vscode.window.showWarningMessage(
			"The Toy Box: Could not write print file.",
		);
		return;
	}

	await vscode.env.openExternal(vscode.Uri.file(tmpFile));

	// Delete the temp file after 60 s — enough time for any browser to load it.
	setTimeout(() => {
		try {
			fs.unlinkSync(tmpFile);
		} catch {
			/* already gone */
		}
	}, 60_000);
}

export function registerPrintCommand(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"theToyBox.printFile",
			(uri?: vscode.Uri) => openAndPrint(context, uri),
		),
	);
}
