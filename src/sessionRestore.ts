import * as vscode from "vscode";

interface Session {
	name: string;
	files: string[]; // file URIs as strings
	active?: string; // active file URI
	createdAt: string; // ISO timestamp
}

const STORAGE_KEY = "toybox.sessions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadSessions(context: vscode.ExtensionContext): Session[] {
	return context.workspaceState.get<Session[]>(STORAGE_KEY, []);
}

function saveSessions(
	context: vscode.ExtensionContext,
	sessions: Session[],
): void {
	context.workspaceState.update(STORAGE_KEY, sessions);
}

function getOpenFiles(): { files: string[]; active?: string } {
	const files = vscode.window.tabGroups.all
		.flatMap((g) => g.tabs)
		.map((t) => {
			const input = t.input as { uri?: vscode.Uri } | undefined;
			return input?.uri?.toString();
		})
		.filter((u): u is string => u !== undefined);

	const active = vscode.window.activeTextEditor?.document.uri.toString();
	return { files: [...new Set(files)], active };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function saveSession(context: vscode.ExtensionContext) {
	const enabled = vscode.workspace
		.getConfiguration("theToyBox.sessionRestore")
		.get<boolean>("enabled", true);
	if (!enabled) {
		vscode.window.showInformationMessage(
			"The Toy Box: Session Restore is disabled. Enable it via theToyBox.sessionRestore.enabled.",
		);
		return;
	}
	const { files, active } = getOpenFiles();

	if (files.length === 0) {
		vscode.window.showWarningMessage(
			"The Toy Box: No open files to save as a session.",
		);
		return;
	}

	const name = await vscode.window.showInputBox({
		prompt: "Session name",
		placeHolder: "e.g. Feature/auth-refactor",
		validateInput: (v) =>
			v.trim().length === 0 ? "Name cannot be empty." : undefined,
	});

	if (!name) {
		return;
	}

	const sessions = loadSessions(context);
	const trimmedName = name.trim();

	// Replace existing session with the same name, or push a new one
	const existingIdx = sessions.findIndex(
		(s) => s.name.toLowerCase() === trimmedName.toLowerCase(),
	);

	const session: Session = {
		name: trimmedName,
		files,
		active,
		createdAt: new Date().toISOString(),
	};

	if (existingIdx >= 0) {
		const choice = await vscode.window.showWarningMessage(
			`Overwrite existing session "${trimmedName}"?`,
			{ modal: true },
			"Overwrite",
		);
		if (choice !== "Overwrite") {
			return;
		}
		sessions[existingIdx] = session;
	} else {
		sessions.push(session);
	}

	saveSessions(context, sessions);
	vscode.window.showInformationMessage(
		`The Toy Box: Session "${trimmedName}" saved (${files.length} file${files.length !== 1 ? "s" : ""}).`,
	);
}

async function restoreSession(context: vscode.ExtensionContext) {
	const enabled = vscode.workspace
		.getConfiguration("theToyBox.sessionRestore")
		.get<boolean>("enabled", true);
	if (!enabled) {
		vscode.window.showInformationMessage(
			"The Toy Box: Session Restore is disabled. Enable it via theToyBox.sessionRestore.enabled.",
		);
		return;
	}
	const sessions = loadSessions(context);

	if (sessions.length === 0) {
		vscode.window.showInformationMessage(
			'The Toy Box: No saved sessions. Use "The Toy Box: Save Session" first.',
		);
		return;
	}

	const picks = sessions.map((s) => ({
		label: s.name,
		description: `${s.files.length} file${s.files.length !== 1 ? "s" : ""}`,
		detail: `Saved ${new Date(s.createdAt).toLocaleString()}`,
		session: s,
	}));

	const pick = await vscode.window.showQuickPick(picks, {
		placeHolder: "Select a session to restore",
		title: "Restore Session",
	});

	if (!pick) {
		return;
	}

	const { session } = pick;
	let opened = 0;
	let activeEditor: vscode.TextEditor | undefined;

	for (const uriStr of session.files) {
		try {
			const uri = vscode.Uri.parse(uriStr);
			const doc = await vscode.workspace.openTextDocument(uri);
			const editor = await vscode.window.showTextDocument(doc, {
				preview: false,
				preserveFocus: true,
			});
			opened++;
			if (uriStr === session.active) {
				activeEditor = editor;
			}
		} catch {
			// File no longer exists — skip silently
		}
	}

	// Bring the previously active file to focus
	if (activeEditor) {
		await vscode.window.showTextDocument(activeEditor.document, {
			preview: false,
		});
	}

	vscode.window.showInformationMessage(
		`The Toy Box: Session "${session.name}" restored (${opened} of ${session.files.length} file${session.files.length !== 1 ? "s" : ""} opened).`,
	);
}

async function manageSessions(context: vscode.ExtensionContext) {
	const enabled = vscode.workspace
		.getConfiguration("theToyBox.sessionRestore")
		.get<boolean>("enabled", true);
	if (!enabled) {
		vscode.window.showInformationMessage(
			"The Toy Box: Session Restore is disabled. Enable it via theToyBox.sessionRestore.enabled.",
		);
		return;
	}
	const sessions = loadSessions(context);

	if (sessions.length === 0) {
		vscode.window.showInformationMessage("The Toy Box: No saved sessions.");
		return;
	}

	const picks = sessions.map((s) => ({
		label: `$(trash) ${s.name}`,
		description: `${s.files.length} file${s.files.length !== 1 ? "s" : ""} · ${new Date(s.createdAt).toLocaleString()}`,
		name: s.name,
	}));

	picks.push({
		label: "$(trash) Delete ALL sessions",
		description: "",
		name: "__ALL__",
	});

	const selected = await vscode.window.showQuickPick(picks, {
		placeHolder: "Select a session to delete",
		title: "Manage Sessions",
		canPickMany: true,
	});

	if (!selected || selected.length === 0) {
		return;
	}

	const deleteAll = selected.some((p) => p.name === "__ALL__");
	const toDelete = deleteAll
		? sessions.map((s) => s.name)
		: selected.filter((p) => p.name !== "__ALL__").map((p) => p.name);

	const remaining = deleteAll
		? []
		: sessions.filter((s) => !toDelete.includes(s.name));

	const choice = await vscode.window.showWarningMessage(
		deleteAll
			? "Delete all sessions?"
			: `Delete ${toDelete.length} session${toDelete.length !== 1 ? "s" : ""}?`,
		{ modal: true },
		"Delete",
	);

	if (choice !== "Delete") {
		return;
	}

	saveSessions(context, remaining);
	vscode.window.showInformationMessage(
		`The Toy Box: ${toDelete.length} session${toDelete.length !== 1 ? "s" : ""} deleted.`,
	);
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerSessionRestore(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("theToyBox.saveSession", () =>
			saveSession(context),
		),
		vscode.commands.registerCommand("theToyBox.restoreSession", () =>
			restoreSession(context),
		),
		vscode.commands.registerCommand("theToyBox.manageSessions", () =>
			manageSessions(context),
		),
	);
}
