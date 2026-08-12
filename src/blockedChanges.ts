import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { ensurePreCommitHook, removePreCommitHook } from "./blockedChangesHook.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Plain-text file (one workspace-relative POSIX path per line) persisted in
 *  the repo root. Used both by the extension and by the git pre-commit hook. */
const BLOCKED_FILE = ".toybox-blocked.txt";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWorkspaceRoots(): string[] {
	return vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
}

function getOwningRoot(uri: vscode.Uri): string | undefined {
	const contains = (root: string) => {
		const relative = path.relative(root, uri.fsPath);
		return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
	};
	const resolved = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
	if (resolved && contains(resolved)) {
		return resolved;
	}
	return getWorkspaceRoots()
		.filter(contains)
		.sort((a, b) => b.length - a.length)[0];
}

function loadBlockedPaths(root: string): string[] {
	const fp = path.join(root, BLOCKED_FILE);
	if (!fs.existsSync(fp)) {
		return [];
	}
	return fs
		.readFileSync(fp, "utf8")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
}

function saveBlockedPaths(root: string, paths: string[]): void {
	const fp = path.join(root, BLOCKED_FILE);
	if (paths.length === 0) {
		if (fs.existsSync(fp)) {
			fs.unlinkSync(fp);
		}
	} else {
		fs.writeFileSync(fp, paths.join("\n") + "\n");
	}
}

function toRelativePosix(root: string, absolutePath: string): string {
	return path.relative(root, absolutePath).replace(/\\/g, "/");
}

/** Returns the git executable path from VS Code's git.path setting, falling
 *  back to "git" (relies on PATH). VS Code resolves this correctly even on
 *  machines where git is not in the system PATH. */
function getGitPath(): string {
	try {
		return (
			vscode.workspace.getConfiguration("git").get<string>("path") ||
			"git"
		);
	} catch {
		// vscode.git may not be activated yet (e.g. during extension activation
		// before the built-in Git extension has initialised). Fall back safely.
		return "git";
	}
}

/** Returns true if the file is tracked in the git index. */
function isTrackedByGit(root: string, relPath: string): boolean {
	try {
		execFileSync(getGitPath(), ["ls-files", "--error-unmatch", relPath], {
			cwd: root,
			stdio: ["ignore", "ignore", "ignore"],
		});
		return true;
	} catch {
		return false;
	}
}

/** Marks (or un-marks) a tracked file so Git ignores local changes to it.
 *  When skip=true the file disappears from Git's working tree status,
 *  hiding it from VS Code's "Changes" section.
 *  Returns true on success, false if git is not found or the command fails. */
function setSkipWorktree(
	root: string,
	relPath: string,
	skip: boolean,
): boolean {
	try {
		const flag = skip ? "--skip-worktree" : "--no-skip-worktree";
		execFileSync(getGitPath(), ["update-index", flag, relPath], {
			cwd: root,
		});
		return true;
	} catch {
		return false;
	}
}

/** Adds or removes a path from `.git/info/exclude` (a local-only gitignore
 *  that is never committed).  Used to hide untracked files from the Changes
 *  view without touching the project's .gitignore. */
function setGitInfoExclude(
	root: string,
	relPath: string,
	exclude: boolean,
): boolean {
	const excludePath = path.join(root, ".git", "info", "exclude");
	try {
		let content = "";
		if (fs.existsSync(excludePath)) {
			content = fs.readFileSync(excludePath, "utf8");
		}
		if (exclude) {
			const lines = content.split(/\r?\n/);
			if (!lines.some((l) => l.trim() === relPath)) {
				fs.writeFileSync(
					excludePath,
					content.trimEnd() + "\n" + relPath + "\n",
				);
			}
		} else {
			const lines = content.split(/\r?\n/);
			const filtered = lines.filter((l) => l.trim() !== relPath);
			if (filtered.length !== lines.length) {
				fs.writeFileSync(excludePath, filtered.join("\n"));
			}
		}
		return true;
	} catch {
		return false;
	}
}

/** Hides (or un-hides) a file from VS Code's Changes view.
 *  For tracked files uses --skip-worktree; for untracked files uses
 *  .git/info/exclude so the file is treated as ignored locally. */
function hideFromChanges(
	root: string,
	relPath: string,
	hide: boolean,
): boolean {
	if (isTrackedByGit(root, relPath)) {
		return setSkipWorktree(root, relPath, hide);
	} else {
		// Untracked file: --skip-worktree doesn't apply; use local exclude instead.
		return setGitInfoExclude(root, relPath, hide);
	}
}

// ─── Tree view ────────────────────────────────────────────────────────────────

/** One row in the Blocked Changes tree view. */
class BlockedFileItem extends vscode.TreeItem {
	constructor(
		public readonly relPath: string,
		public readonly root: string,
	) {
		super(path.basename(relPath), vscode.TreeItemCollapsibleState.None);
		this.resourceUri = vscode.Uri.file(path.join(root, relPath));
		const dir = path.dirname(relPath);
		this.description = dir === "." ? "" : dir;
		this.tooltip = `${relPath} — blocked from commit`;
		this.contextValue = "blockedFile";
		this.command = {
			title: "Open File",
			command: "vscode.open",
			arguments: [this.resourceUri],
		};
	}
}

class BlockedChangesProvider implements vscode.TreeDataProvider<BlockedFileItem> {
	private readonly _onDidChangeTreeData =
		new vscode.EventEmitter<undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private readonly roots: string[]) {}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: BlockedFileItem): vscode.TreeItem {
		return element;
	}

	getChildren(): BlockedFileItem[] {
		return this.roots.flatMap((root) =>
			loadBlockedPaths(root).map((p) => new BlockedFileItem(p, root)),
		);
	}
}

/** Adds (or verifies) `.toybox-blocked.txt` entry in the repo's .gitignore.
 *  Does nothing if the entry is already present. */
function ensureGitignoreEntry(root: string): void {
	const giPath = path.join(root, ".gitignore");
	const entry = BLOCKED_FILE;
	try {
		if (fs.existsSync(giPath)) {
			const contents = fs.readFileSync(giPath, "utf8");
			// Check for an exact line match
			const lines = contents.split(/\r?\n/);
			if (lines.some((l) => l.trim() === entry)) {
				return;
			}
			fs.writeFileSync(giPath, contents.trimEnd() + "\n" + entry + "\n");
		} else {
			fs.writeFileSync(giPath, entry + "\n");
		}
	} catch {
		// Non-fatal
	}
}

/** Removes the `.toybox-blocked.txt` entry from .gitignore if present. */
function removeGitignoreEntry(root: string): void {
	const giPath = path.join(root, ".gitignore");
	const entry = BLOCKED_FILE;
	try {
		if (!fs.existsSync(giPath)) {
			return;
		}
		const raw = fs.readFileSync(giPath, "utf8");
		// Preserve original line endings (CRLF on Windows, LF on Unix)
		const eol = raw.includes("\r\n") ? "\r\n" : "\n";
		const lines = raw.split(/\r?\n/);
		const filtered = lines.filter((l) => l.trim() !== entry);
		if (filtered.length === lines.length) {
			return; // nothing to remove
		}
		fs.writeFileSync(giPath, filtered.join(eol));
	} catch {
		// Non-fatal
	}
}

// ─── Public registration ──────────────────────────────────────────────────────

export function registerBlockedChanges(context: vscode.ExtensionContext): void {
	const roots = getWorkspaceRoots();
	if (roots.length === 0) {
		return;
	}

	// A TreeDataProvider is used instead of an SCM provider so the
	// "Blocked Changes" section is permanently visible in the Source Control
	// panel and is never hidden by VS Code when the list is empty.
	const provider = new BlockedChangesProvider(roots);
	const treeView = vscode.window.createTreeView("blockedChangesView", {
		treeDataProvider: provider,
	});

	context.subscriptions.push(treeView);

	// On activation, ensure all already-blocked files are hidden from Changes
	// (the git index flag may have been lost after a clone or index reset).
	const isEnabled = () =>
		vscode.workspace
			.getConfiguration("theToyBox")
			.get<boolean>("blockedChanges.enabled", true);

	if (isEnabled()) {
		for (const root of roots) {
			ensurePreCommitHook(root);
			for (const relPath of loadBlockedPaths(root)) {
				hideFromChanges(root, relPath, true);
			}
		}
	} else {
		for (const root of roots) {
			removePreCommitHook(root);
		}
	}

	// React to the enabled setting being toggled.
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("theToyBox.blockedChanges.enabled")) {
				const enabled = isEnabled();
				for (const root of roots) {
					if (enabled) {
						ensurePreCommitHook(root);
					} else {
						removePreCommitHook(root);
					}
					for (const relPath of loadBlockedPaths(root)) {
						hideFromChanges(root, relPath, enabled);
					}
				}
			}
		}),
	);

	// On activation: only add the .gitignore entry if the setting is enabled.
	// Never remove it automatically — a teammate may have checked it in
	// intentionally even if the local setting is unchecked.
	const isGitignoreEnabled = () =>
		vscode.workspace
			.getConfiguration("theToyBox")
			.get<boolean>("blockedChanges.addToGitignore", false);

	if (isGitignoreEnabled()) {
		for (const root of roots) {
			ensureGitignoreEntry(root);
		}
	}

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (
				e.affectsConfiguration(
					"theToyBox.blockedChanges.addToGitignore",
				)
			) {
				if (isGitignoreEnabled()) {
					for (const root of roots) {
						ensureGitignoreEntry(root);
					}
				} else {
					const choice = await vscode.window.showWarningMessage(
						`Remove "${BLOCKED_FILE}" from .gitignore?`,
						{ modal: true },
						"Yes",
						"No",
					);
					if (choice === "Yes") {
						for (const root of roots) {
							removeGitignoreEntry(root);
						}
					}
				}
			}
		}),
	);

	// ── Branch-switch safety check ─────────────────────────────────────────────
	// If a blocked file (hidden by --skip-worktree) has local modifications that
	// differ from HEAD, git will refuse to switch branches.  We detect this by
	// comparing each tracked blocked file's disk content against the committed
	// blob, then warn the user so they know to stash or discard first.

	let branchWarnShown = false;

	const getDirtyBlocked = (): Array<{ root: string; relPath: string }> =>
		roots.flatMap((root) => {
			try {
				return loadBlockedPaths(root).filter((relPath) => {
				if (!isTrackedByGit(root, relPath)) {
					return false;
				}
				try {
					const committed = execFileSync(
						getGitPath(),
						["show", `HEAD:${relPath}`],
						{ cwd: root, stdio: ["ignore", "pipe", "ignore"] },
					);
					const diskPath = path.join(root, relPath);
					if (!fs.existsSync(diskPath)) {
						return false;
					}
					return !committed.equals(fs.readFileSync(diskPath));
				} catch {
					return false;
				}
				}).map((relPath) => ({ root, relPath }));
			} catch {
				return [];
			}
		});

	/** Re-read the persisted list, refresh the tree, and update status messages.
	 *  Also checks for dirty blocked files and shows a branch-switch warning. */

	const refresh = () => {
		provider.refresh();
		const blocked = roots.flatMap((root) => loadBlockedPaths(root));

		if (blocked.length === 0) {
			treeView.message =
				"No blocked files. Right-click a file in Changes and choose Block Change.";
			branchWarnShown = false;
			return;
		}

		const dirty = getDirtyBlocked();
		if (dirty.length > 0) {
			const plural = dirty.length !== 1;
			treeView.message = `⚠ ${dirty.length} blocked file${
				plural ? "s have" : " has"
			} local changes — stash or discard before switching branches.`;

			if (!branchWarnShown) {
				branchWarnShown = true;
				const names = dirty
					.map(({ relPath }) => `"${path.basename(relPath)}"`)
					.join(", ");
				vscode.window
					.showWarningMessage(
						`Blocked Changes: ${names} ${
							plural ? "have" : "has"
						} local modifications. You won't be able to switch branches until you stash or discard ${
							plural ? "them" : "it"
						}.`,
						"Show Blocked Files",
					)
					.then((choice) => {
						if (choice === "Show Blocked Files") {
							vscode.commands.executeCommand(
								"blockedChangesView.focus",
							);
						}
					});
			}
		} else {
			branchWarnShown = false;
			treeView.message = undefined;
		}
	};

	refresh(); // set initial state

	// ── Commands ───────────────────────────────────────────────────────────────

	context.subscriptions.push(
		// Block — triggered from scm/resourceState/context on Git workingTree items
		vscode.commands.registerCommand(
			"theToyBox.blockChange",
			async (resource: vscode.SourceControlResourceState) => {
				if (!resource?.resourceUri || !isEnabled()) {
					return;
				}
				const root = getOwningRoot(resource.resourceUri);
				if (!root) {
					vscode.window.showWarningMessage("The Toy Box: The selected file is outside the workspace.");
					return;
				}
				const rel = toRelativePosix(root, resource.resourceUri.fsPath);
				const blocked = loadBlockedPaths(root);
				if (!blocked.includes(rel)) {
					blocked.push(rel);
					saveBlockedPaths(root, blocked);
					const hidden = hideFromChanges(root, rel, true);
					if (!hidden) {
						vscode.window.showWarningMessage(
							`The Toy Box: "${path.basename(rel)}" was added to Blocked Changes but could not be hidden from the Changes view — git may not be accessible.`,
						);
					}
					// Force VS Code's Git extension to re-scan immediately so the
					// file disappears from the Changes view without waiting for
					// the next poll cycle (which causes a 2–3 s visible delay).
					const api = getActiveGitApi();
					await api?.getRepository(resource.resourceUri)?.status();
					refresh();
				}
			},
		),

		// Unblock — triggered from view/item/context on BlockedFileItem rows
		vscode.commands.registerCommand(
			"theToyBox.unblockChange",
			async (item: BlockedFileItem) => {
				if (!item?.relPath || !item.root) {
					return;
				}
				hideFromChanges(item.root, item.relPath, false);
				saveBlockedPaths(
					item.root,
					loadBlockedPaths(item.root).filter((p) => p !== item.relPath),
				);
				const api = getActiveGitApi();
				await api?.getRepository(item.resourceUri)?.status();
				refresh();
			},
		),

		// Discard — triggered from view/item/context on BlockedFileItem rows
		vscode.commands.registerCommand(
			"theToyBox.discardBlockedChange",
			async (item: BlockedFileItem) => {
				if (!item?.resourceUri) {
					return;
				}

				const fileName = path.basename(item.relPath);

				const choice = await vscode.window.showWarningMessage(
					`Discard all changes to "${fileName}"? This cannot be undone.`,
					{ modal: true },
					"Discard Changes",
				);
				if (choice !== "Discard Changes") {
					return;
				}

				const api = getActiveGitApi();
				const repo = api?.getRepository(item.resourceUri);

				if (!repo) {
					vscode.window.showErrorMessage(
						`The Toy Box: Could not discard "${fileName}" — Git repository not found.`,
					);
					return;
				}

				try {
					hideFromChanges(item.root, item.relPath, false);
					await repo.clean([item.resourceUri]);
				} catch (err: unknown) {
					// Re-apply the hide so the file stays hidden in Changes
					// and remains in the Blocked Changes list in a consistent state.
					hideFromChanges(item.root, item.relPath, true);
					const msg =
						err instanceof Error ? err.message : String(err);
					vscode.window.showErrorMessage(
						`The Toy Box: Failed to discard "${fileName}": ${msg}`,
					);
					return;
				}

				saveBlockedPaths(
					item.root,
					loadBlockedPaths(item.root).filter((p) => p !== item.relPath),
				);
				refresh();
			},
		),
	);

	// ── File-save subscription ────────────────────────────────────────────────
	// Re-check dirty state whenever the user saves a blocked file.
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((doc) => {
			const root = getOwningRoot(doc.uri);
			if (!root) {
				return;
			}
			const rel = toRelativePosix(root, doc.uri.fsPath);
			if (loadBlockedPaths(root).includes(rel)) {
				refresh();
			}
		}),
	);

	// ── Git-state subscription ────────────────────────────────────────────────
	// Re-check when the repository state changes (stash, rebase, merge, etc.)
	// so the warning clears automatically once the user resolves the situation.
	// Debounced to avoid hammering git on rapid-fire change events.
	let stateRefreshTimer: ReturnType<typeof setTimeout> | undefined;
	const gitApi = getActiveGitApi();
	for (const root of roots) {
		const gitRepo = gitApi?.getRepository(vscode.Uri.file(root));
		if (gitRepo) {
			context.subscriptions.push(
				gitRepo.state.onDidChange(() => {
					clearTimeout(stateRefreshTimer);
					stateRefreshTimer = setTimeout(refresh, 1500);
				}),
			);
		}
	}
}

function getActiveGitApi(): any | undefined {
	try {
		const extension = vscode.extensions.getExtension("vscode.git");
		return extension?.isActive ? extension.exports?.getAPI(1) : undefined;
	} catch {
		return undefined;
	}
}
