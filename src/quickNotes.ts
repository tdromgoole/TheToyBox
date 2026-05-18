import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const LANG_MAP_KEY = "toybox.quickNotes.languages";
const NEXT_ID_KEY = "toybox.quickNotes.nextId";
const UNTITLED_MAP_KEY = "toybox.quickNotes.untitledMap";

let notesDir: string;
let extContext: vscode.ExtensionContext;
let out: vscode.OutputChannel;
let deactivating = false;
const saveTimers = new Map<string, NodeJS.Timeout>();

// Stores the latest text for each tracked untitled URI, used briefly during
// the conversion to a named note file (before the note file is opened).
const untitledContent = new Map<string, string>();

// Untitled URIs that have already been converted to a named note file.
// Prevents re-entry if VS Code fires additional change events on the same doc.
const alreadyConverted = new Set<string>();

// Set to true while handleNoteDirChange is closing old tabs to suppress the
// duplicate dialog that would otherwise fire from onTabsClosed.
let changingDir = false;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerQuickNotes(ctx: vscode.ExtensionContext): void {
	extContext = ctx;
	out = vscode.window.createOutputChannel("Quick Notes");
	ctx.subscriptions.push(out);
	notesDir = resolveNotesDir(ctx);
	fs.mkdirSync(notesDir, { recursive: true });
	out.appendLine(`[init] notesDir = ${notesDir}`);

	if (isFeatureEnabled()) {
		void openAllNotes();
	}

	ctx.subscriptions.push(
		vscode.commands.registerCommand("theToyBox.newQuickNote", newQuickNote),
		vscode.commands.registerCommand(
			"theToyBox.openQuickNote",
			openQuickNote,
		),
		vscode.commands.registerCommand(
			"theToyBox.saveQuickNoteAsFile",
			saveActiveQuickNoteAsFile,
		),
		vscode.commands.registerCommand(
			"theToyBox.quickNotes.resetNotesFolder",
			() => {
				vscode.workspace
					.getConfiguration()
					.update(
						"theToyBox.quickNotes.notesFolder",
						undefined,
						vscode.ConfigurationTarget.Global,
					);
			},
		),
		vscode.commands.registerCommand(
			"workbench.action.files.save",
			async () => {
				const doc = vscode.window.activeTextEditor?.document;
				if (doc && isNoteFile(doc.uri.fsPath)) {
					await saveActiveQuickNoteAsFile();
				} else if (doc) {
					// Use doc.save() directly to avoid infinite recursion.
					await doc.save();
				}
			},
		),
		vscode.workspace.onDidOpenTextDocument(onDocumentOpened),
		vscode.workspace.onDidChangeTextDocument(onDocumentChanged),
		vscode.workspace.onDidCloseTextDocument(onDocumentClosed),
		vscode.window.tabGroups.onDidChangeTabs(onTabsClosed),
		vscode.workspace.onDidChangeConfiguration(onConfigChanged),
	);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isFeatureEnabled(): boolean {
	return vscode.workspace
		.getConfiguration("theToyBox.quickNotes")
		.get<boolean>("enabled", true);
}

function resolveNotesDir(ctx?: vscode.ExtensionContext): string {
	const custom = vscode.workspace
		.getConfiguration("theToyBox.quickNotes")
		.get<string>("notesFolder", "");
	if (custom && custom.trim() !== "") {
		let resolved = custom.trim();
		if (resolved.startsWith("~")) {
			const home = os.homedir();
			resolved = path.join(home, resolved.slice(1));
		}
		return resolved;
	}
	const base = ctx ?? extContext;
	return path.join(base.globalStorageUri.fsPath, "notes");
}

function onConfigChanged(e: vscode.ConfigurationChangeEvent): void {
	if (
		!e.affectsConfiguration("theToyBox.quickNotes.enabled") &&
		!e.affectsConfiguration("theToyBox.quickNotes.notesFolder")
	) {
		return;
	}

	const newDir = resolveNotesDir();
	if (newDir !== notesDir) {
		// Don't update notesDir yet — handleNoteDirChange does it after closing
		// the currently-open note tabs so isNoteFile can still resolve them.
		void handleNoteDirChange(notesDir, newDir);
	} else if (isFeatureEnabled()) {
		void openAllNotes();
	}
}

/**
 * Called when the notes directory setting changes. Prompts for each currently
 * open note tab, then switches notesDir to newDir and opens notes from there.
 * changingDir suppresses onTabsClosed while we handle tabs here so each note
 * gets exactly one prompt.
 */
async function handleNoteDirChange(
	oldDir: string,
	newDir: string,
): Promise<void> {
	// Collect all open note tabs from the old directory.
	const oldTabs: Array<{
		tab: vscode.Tab;
		noteName: string;
		filePath: string;
	}> = [];
	for (const tabGroup of vscode.window.tabGroups.all) {
		for (const tab of tabGroup.tabs) {
			if (!(tab.input instanceof vscode.TabInputText)) {
				continue;
			}
			const fsPath = (tab.input as vscode.TabInputText).uri.fsPath;
			const rel = path.relative(oldDir, fsPath);
			if (
				!rel.startsWith("..") &&
				!path.isAbsolute(rel) &&
				!rel.includes(path.sep) &&
				/^toybox-note-\d+$/.test(rel)
			) {
				oldTabs.push({ tab, noteName: rel, filePath: fsPath });
			}
		}
	}

	// Suppress onTabsClosed while we close these tabs manually.
	changingDir = true;
	try {
		for (const { tab, noteName, filePath } of oldTabs) {
			if (!fs.existsSync(filePath)) {
				try {
					await vscode.window.tabGroups.close(tab, true);
				} catch {
					/* ignore */
				}
				continue;
			}
			const choice = await vscode.window.showInformationMessage(
				`Quick note "${noteName}" is from the previous notes folder. What would you like to do?`,
				"Save as File",
				"Keep for Later",
				"Delete",
			);
			if (choice === "Save as File") {
				await saveNoteAsFile(filePath, noteName);
			} else if (choice === "Delete") {
				deleteNote(filePath, noteName);
			}
			// Close the tab regardless — it belongs to the old directory.
			// "Keep for Later" leaves the file on disk but stops tracking it.
			try {
				await vscode.window.tabGroups.close(tab, true);
			} catch {
				/* ignore */
			}
		}
	} finally {
		changingDir = false;
	}

	// Now switch to the new directory.
	notesDir = newDir;
	fs.mkdirSync(notesDir, { recursive: true });
	out.appendLine(`[config] notesDir changed to ${notesDir}`);
	if (isFeatureEnabled()) {
		void openAllNotes();
	}
}

/**
 * Returns the note filename if the given fsPath is inside the notes directory,
 * or undefined otherwise.
 */
function isNoteFile(fsPath: string): string | undefined {
	const rel = path.relative(notesDir, fsPath);
	// Must be a direct child (no subdirectory, not outside the notes dir)
	if (
		!rel.startsWith("..") &&
		!path.isAbsolute(rel) &&
		!rel.includes(path.sep)
	) {
		return rel;
	}
	return undefined;
}

async function applyStoredLanguage(
	doc: vscode.TextDocument,
	noteName: string,
): Promise<void> {
	const langMap = extContext.globalState.get<Record<string, string>>(
		LANG_MAP_KEY,
		{},
	);
	const savedLang = langMap[noteName];
	if (savedLang && savedLang !== doc.languageId) {
		try {
			await vscode.languages.setTextDocumentLanguage(doc, savedLang);
		} catch {
			// Language ID may no longer be valid (e.g. extension uninstalled); ignore.
		}
	}
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function openAllNotes(): Promise<void> {
	const entries = fs.readdirSync(notesDir);
	const noteFiles = entries.filter((name) => name.startsWith("toybox-note-"));
	for (const name of noteFiles) {
		const uri = vscode.Uri.file(path.join(notesDir, name));
		await vscode.window.showTextDocument(uri, {
			preview: false,
			preserveFocus: true,
		});
	}
}

async function newQuickNote(): Promise<void> {
	// Find the lowest positive integer not already used by an existing note file.
	const existing = new Set(
		fs
			.readdirSync(notesDir)
			.map((name) => {
				const m = name.match(/^toybox-note-(\d+)$/);
				return m ? parseInt(m[1], 10) : null;
			})
			.filter((n): n is number => n !== null),
	);
	let nextId = 1;
	while (existing.has(nextId)) {
		nextId++;
	}
	const noteName = `toybox-note-${nextId}`;
	const filePath = path.join(notesDir, noteName);

	fs.writeFileSync(filePath, "", "utf8");

	const doc = await vscode.workspace.openTextDocument(
		vscode.Uri.file(filePath),
	);
	await vscode.window.showTextDocument(doc);
}

async function openQuickNote(): Promise<void> {
	let files: string[];
	try {
		files = fs
			.readdirSync(notesDir)
			.filter((f) => f.startsWith("toybox-note-"))
			.sort((a, b) => {
				const na = parseInt(a.replace("toybox-note-", ""), 10);
				const nb = parseInt(b.replace("toybox-note-", ""), 10);
				return na - nb;
			});
	} catch {
		files = [];
	}

	if (files.length === 0) {
		vscode.window.showInformationMessage(
			"No quick notes found. Use 'The Toy Box: New Quick Note' to create one.",
		);
		return;
	}

	const langMap = extContext.globalState.get<Record<string, string>>(
		LANG_MAP_KEY,
		{},
	);
	const items = files.map((f) => ({
		label: f,
		description: langMap[f] ?? "plaintext",
		filePath: path.join(notesDir, f),
	}));

	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: "Select a quick note to open",
	});
	if (!selected) {
		return;
	}

	const doc = await vscode.workspace.openTextDocument(
		vscode.Uri.file(selected.filePath),
	);
	await vscode.window.showTextDocument(doc);
	// Language is re-applied by onDocumentOpened, but call here too in case the
	// document was already open (onDidOpenTextDocument won't fire again).
	await applyStoredLanguage(doc, selected.label);
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function onDocumentOpened(doc: vscode.TextDocument): Promise<void> {
	if (!isFeatureEnabled()) {
		return;
	}
	const noteName = isNoteFile(doc.uri.fsPath);
	if (!noteName) {
		return;
	}
	if (doc.languageId === "plaintext") {
		// VS Code defaulted to plaintext because the file has no extension.
		// Restore whatever language the user last chose for this note.
		await applyStoredLanguage(doc, noteName);
	} else {
		// Document opened with a specific language — either the user just changed
		// it via "Select Language Mode" (which fires a close+reopen) or
		// applyStoredLanguage previously set it. Persist the current language so
		// we don't revert it on the next open.
		const langMap = extContext.globalState.get<Record<string, string>>(
			LANG_MAP_KEY,
			{},
		);
		if (langMap[noteName] !== doc.languageId) {
			langMap[noteName] = doc.languageId;
			extContext.globalState.update(LANG_MAP_KEY, langMap);
		}
	}
}

/**
 * Closes a specific editor tab by its document URI using the Tab Groups API.
 * Passing preserveFocus=true avoids stealing keyboard focus from the active
 * editor. For non-dirty tabs this is completely silent (no dialog).
 */
async function closeTabByUri(uriStr: string): Promise<void> {
	for (const tabGroup of vscode.window.tabGroups.all) {
		for (const tab of tabGroup.tabs) {
			const input = tab.input;
			if (
				input instanceof vscode.TabInputText &&
				input.uri.toString() === uriStr
			) {
				try {
					await vscode.window.tabGroups.close(tab, true);
				} catch {
					/* not critical */
				}
				return;
			}
		}
	}
}

function onDocumentChanged(e: vscode.TextDocumentChangeEvent): void {
	if (!isFeatureEnabled()) {
		return;
	}
	if (e.contentChanges.length === 0) {
		return;
	}

	// Handle standard untitled files (Ctrl+N / double-click new tab)
	if (e.document.uri.scheme === "untitled") {
		out.appendLine(
			`[change] untitled: ${e.document.uri.toString()}, changes: ${e.contentChanges.length}`,
		);
		handleUntitledChange(e.document);
		return;
	}

	const noteName = isNoteFile(e.document.uri.fsPath);
	if (!noteName) {
		return;
	}

	// Debounce: reset the timer on each keystroke, save 1 s after typing stops.
	if (saveTimers.has(noteName)) {
		clearTimeout(saveTimers.get(noteName)!);
	}
	const docUri = e.document.uri.toString();
	saveTimers.set(
		noteName,
		setTimeout(async () => {
			saveTimers.delete(noteName);
			const doc = vscode.workspace.textDocuments.find(
				(d) => d.uri.toString() === docUri,
			);
			if (!doc?.isDirty) {
				return;
			}
			await doc.save();
			// Persist the current language alongside the save.
			const langMap = extContext.globalState.get<Record<string, string>>(
				LANG_MAP_KEY,
				{},
			);
			langMap[noteName] = doc.languageId;
			extContext.globalState.update(LANG_MAP_KEY, langMap);
		}, 1000),
	);
}

function handleUntitledChange(doc: vscode.TextDocument): void {
	const uriStr = doc.uri.toString();

	// After conversion the untitled file is replaced by the named note;
	// ignore any further events on the old untitled URI.
	if (alreadyConverted.has(uriStr)) {
		return;
	}

	// Always update the cache — we need the latest content when the timer fires.
	untitledContent.set(uriStr, doc.getText());
	out.appendLine(
		`[untitled] cached content (${doc.getText().length} chars) for ${uriStr}`,
	);

	// Assign a note name on first change so it stays stable across timer resets.
	const untitledMap = extContext.globalState.get<Record<string, string>>(
		UNTITLED_MAP_KEY,
		{},
	);
	if (!untitledMap[uriStr]) {
		const existingIds = new Set(
			fs
				.readdirSync(notesDir)
				.map((name) => {
					const m = name.match(/^toybox-note-(\d+)$/);
					return m ? parseInt(m[1], 10) : null;
				})
				.filter((n): n is number => n !== null),
		);
		let nextId = 1;
		while (existingIds.has(nextId)) {
			nextId++;
		}
		untitledMap[uriStr] = `toybox-note-${nextId}`;
		extContext.globalState.update(UNTITLED_MAP_KEY, untitledMap);
		out.appendLine(
			`[untitled] assigned ${untitledMap[uriStr]} to ${uriStr}`,
		);
	}
	const noteName = untitledMap[uriStr];

	// Debounce the conversion so it fires after the user pauses typing.
	// This captures ALL typed content before the note file is opened.
	if (saveTimers.has(uriStr)) {
		clearTimeout(saveTimers.get(uriStr)!);
	}
	saveTimers.set(
		uriStr,
		setTimeout(() => {
			saveTimers.delete(uriStr);
			if (!alreadyConverted.has(uriStr)) {
				alreadyConverted.add(uriStr);
				void convertUntitledToNote(doc, noteName);
			}
		}, 500),
	);
}

async function convertUntitledToNote(
	doc: vscode.TextDocument,
	noteName: string,
): Promise<void> {
	const uriStr = doc.uri.toString();
	const noteFilePath = path.join(notesDir, noteName);
	const content = untitledContent.get(uriStr) ?? doc.getText();
	out.appendLine(
		`[convert] ${uriStr} → ${noteName} (${content.length} chars)`,
	);

	// Write the current content to the note file.
	try {
		fs.writeFileSync(noteFilePath, content, "utf8");
	} catch (err) {
		out.appendLine(`[convert] write failed: ${err}`);
		alreadyConverted.delete(uriStr);
		return;
	}

	// Find which view column the untitled editor is currently in.
	const untitledEditor = vscode.window.visibleTextEditors.find(
		(e) => e.document.uri.toString() === uriStr,
	);
	const viewColumn = untitledEditor?.viewColumn ?? vscode.ViewColumn.Active;

	// Open the note file in the same column — tab title now shows the note name.
	const noteUri = vscode.Uri.file(noteFilePath);
	let noteDoc: vscode.TextDocument;
	try {
		noteDoc = await vscode.workspace.openTextDocument(noteUri);
		await vscode.window.showTextDocument(noteDoc, {
			viewColumn,
			preview: false,
		});
		out.appendLine(`[convert] opened note file`);
	} catch (err) {
		out.appendLine(`[convert] openTextDocument failed: ${err}`);
		alreadyConverted.delete(uriStr);
		return;
	}

	// Remove from untitled tracking BEFORE closing the tab. The close triggers
	// onDocumentClosed synchronously; if the map entry is still present when
	// that fires, the handler shows the "auto-saved" notification incorrectly.
	const untitledMap = extContext.globalState.get<Record<string, string>>(
		UNTITLED_MAP_KEY,
		{},
	);
	delete untitledMap[uriStr];
	extContext.globalState.update(UNTITLED_MAP_KEY, untitledMap);
	untitledContent.delete(uriStr);

	// Persist the language.
	const langMap = extContext.globalState.get<Record<string, string>>(
		LANG_MAP_KEY,
		{},
	);
	langMap[noteName] = doc.languageId;
	extContext.globalState.update(LANG_MAP_KEY, langMap);

	// Close the untitled tab. The debounce means the user has paused typing,
	// so the brief focus switch is safe. revertAndCloseActiveEditor discards
	// the dirty content and closes the tab in one step — no dialog.
	const untitledStill = vscode.workspace.textDocuments.find(
		(d) => d.uri.toString() === uriStr,
	);
	if (untitledStill) {
		try {
			await vscode.window.showTextDocument(untitledStill, {
				preserveFocus: false,
			});
			await vscode.commands.executeCommand(
				"workbench.action.revertAndCloseActiveEditor",
			);
		} catch {
			/* ignore: note is correct even if the tab lingers */
		}
		// Restore focus to the note regardless of whether the close succeeded.
		await vscode.window.showTextDocument(noteDoc, { viewColumn });
	}

	out.appendLine(`[convert] complete`);
}

async function onDocumentClosed(doc: vscode.TextDocument): Promise<void> {
	// ── Untitled file closed ──────────────────────────────────────────────────
	if (doc.uri.scheme === "untitled") {
		const uriStr = doc.uri.toString();
		out.appendLine(`[close] untitled closed: ${uriStr}`);
		const untitledMap = extContext.globalState.get<Record<string, string>>(
			UNTITLED_MAP_KEY,
			{},
		);
		const noteName = untitledMap[uriStr];
		if (!noteName) {
			out.appendLine(
				`[close] no noteName found for ${uriStr} — ignoring`,
			);
			alreadyConverted.delete(uriStr); // clean up conversion tracking
			return; // Never had any content changes, nothing to do.
		}

		// Flush any pending debounced write using the content cache.
		// Guard: VS Code fires a synthetic "content cleared" change event immediately
		// before onDidCloseTextDocument, which sets our cache to 0 chars. Only write
		// from the cache when it is non-empty; if it's empty the timer already flushed
		// good content to disk and that synthetic event should be ignored.
		if (saveTimers.has(uriStr)) {
			clearTimeout(saveTimers.get(uriStr)!);
			saveTimers.delete(uriStr);
		}
		const cachedContent = untitledContent.get(uriStr);
		untitledContent.delete(uriStr);
		out.appendLine(
			`[close] cachedContent: ${cachedContent === undefined ? "MISSING" : `${cachedContent.length} chars`}`,
		);
		if (cachedContent) {
			// Non-empty cache means the timer hadn't fired yet — flush now.
			try {
				fs.writeFileSync(
					path.join(notesDir, noteName),
					cachedContent,
					"utf8",
				);
			} catch {
				/* ignore */
			}
		}

		// Remove from the untitled tracking map.
		delete untitledMap[uriStr];
		extContext.globalState.update(UNTITLED_MAP_KEY, untitledMap);

		// If the note file is empty (no content was ever written), clean up silently.
		const filePath = path.join(notesDir, noteName);
		let content = "";
		try {
			content = fs.readFileSync(filePath, "utf8");
		} catch {
			return; // File was never created, nothing to show.
		}
		if (!content.trim()) {
			deleteNote(filePath, noteName);
			return;
		}

		const choice = await vscode.window.showInformationMessage(
			`Your untitled file was auto-saved as "${noteName}". What would you like to do?`,
			"Save as File",
			"Keep as Quick Note",
			"Delete",
		);
		if (choice === "Save as File") {
			await saveNoteAsFile(filePath, noteName);
		} else if (choice === "Delete") {
			deleteNote(filePath, noteName);
		}
		return;
	}

	// ── Named note file closed ────────────────────────────────────────────────
	const noteName = isNoteFile(doc.uri.fsPath);
	if (!noteName) {
		return;
	}
	const filePath = path.join(notesDir, noteName);

	// If a debounced save was still pending, flush the content to disk now.
	if (saveTimers.has(noteName)) {
		clearTimeout(saveTimers.get(noteName)!);
		saveTimers.delete(noteName);
		try {
			fs.writeFileSync(filePath, doc.getText(), "utf8");
			const langMap = extContext.globalState.get<Record<string, string>>(
				LANG_MAP_KEY,
				{},
			);
			langMap[noteName] = doc.languageId;
			extContext.globalState.update(LANG_MAP_KEY, langMap);
		} catch {
			/* ignore write errors */
		}
	}

	// Dialog is handled by onTabsClosed via the Tab Groups API, which correctly
	// ignores language-mode changes (they don't close the tab).
}

async function onTabsClosed({ closed }: vscode.TabChangeEvent): Promise<void> {
	if (deactivating || changingDir || !isFeatureEnabled()) {
		return;
	}
	for (const tab of closed) {
		if (!(tab.input instanceof vscode.TabInputText)) {
			continue;
		}
		const noteName = isNoteFile(tab.input.uri.fsPath);
		if (!noteName) {
			continue;
		}
		const filePath = path.join(notesDir, noteName);
		// If the note was already processed by saveNoteAsFile it will have been
		// deleted from disk — skip to avoid a spurious second dialog.
		if (!fs.existsSync(filePath)) {
			continue;
		}
		const choice = await vscode.window.showInformationMessage(
			`Quick note "${noteName}" was closed. What would you like to do?`,
			"Save as File",
			"Keep for Later",
			"Delete",
		);
		if (choice === "Save as File") {
			await saveNoteAsFile(filePath, noteName);
		} else if (choice === "Delete") {
			deleteNote(filePath, noteName);
		}
	}
}

// ─── Save / Delete ────────────────────────────────────────────────────────────

async function saveActiveQuickNoteAsFile(): Promise<void> {
	const doc = vscode.window.activeTextEditor?.document;
	if (!doc) {
		return;
	}
	const noteName = isNoteFile(doc.uri.fsPath);
	if (!noteName) {
		// Not a quick note — fall through to normal save.
		await vscode.commands.executeCommand("workbench.action.files.save");
		return;
	}
	await saveNoteAsFile(path.join(notesDir, noteName), noteName);
}

async function saveNoteAsFile(
	filePath: string,
	noteName: string,
): Promise<void> {
	const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri
		? vscode.Uri.joinPath(
				vscode.workspace.workspaceFolders[0].uri,
				noteName + ".txt",
			)
		: undefined;

	const saveUri = await vscode.window.showSaveDialog({
		defaultUri,
		title: "Save Quick Note As",
		filters: { "All files": ["*"] },
	});
	if (!saveUri) {
		return;
	}

	try {
		const content = fs.readFileSync(filePath, "utf8");
		await vscode.workspace.fs.writeFile(
			saveUri,
			Buffer.from(content, "utf8"),
		);
	} catch {
		vscode.window.showErrorMessage("Failed to save quick note to file.");
		return;
	}

	deleteNote(filePath, noteName);

	const saved = await vscode.workspace.openTextDocument(saveUri);
	await vscode.window.showTextDocument(saved);
}

function deleteNote(filePath: string, noteName: string): void {
	try {
		fs.unlinkSync(filePath);
	} catch {
		/* ignore */
	}
	const langMap = extContext.globalState.get<Record<string, string>>(
		LANG_MAP_KEY,
		{},
	);
	delete langMap[noteName];
	extContext.globalState.update(LANG_MAP_KEY, langMap);
}

// ─── Deactivation ─────────────────────────────────────────────────────────────

/**
 * Called from the extension's deactivate() hook to ensure any note content
 * that hasn't been flushed yet (e.g. the 1-second debounce timer still
 * pending when VS Code closes) is written to disk synchronously.
 */
export function deactivateQuickNotes(): void {
	deactivating = true;
	for (const [noteKey, timer] of saveTimers) {
		clearTimeout(timer);
		if (!/^toybox-note-\d+$/.test(noteKey)) {
			continue; // untitled URI key — content tracked in untitledContent
		}
		const noteFilePath = path.join(notesDir, noteKey);
		const doc = vscode.workspace.textDocuments.find(
			(d) => d.uri.fsPath === noteFilePath,
		);
		if (doc?.isDirty) {
			try {
				fs.writeFileSync(noteFilePath, doc.getText(), "utf8");
			} catch {
				/* ignore */
			}
		}
	}
	saveTimers.clear();
	untitledContent.clear();
}
