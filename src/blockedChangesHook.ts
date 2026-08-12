import * as fs from "fs";
import * as path from "path";

export const HOOK_START = "# theToyBox:blocked-changes";
export const HOOK_END = "# /theToyBox:blocked-changes";

export const PRE_COMMIT_HOOK_SNIPPET = `${HOOK_START}
TOYBOX_BLOCKED=".toybox-blocked.txt"
if [ -f "$TOYBOX_BLOCKED" ]; then
    TOYBOX_STAGED=$(git diff --cached --name-only)
    if [ -n "$TOYBOX_STAGED" ]; then
        TOYBOX_HITS=""
        while IFS= read -r f || [ -n "$f" ]; do
            [ -z "$f" ] && continue
            if printf '%s\\n' "$TOYBOX_STAGED" | grep -qxF "$f"; then
                TOYBOX_HITS="$TOYBOX_HITS   $f\\n"
            fi
        done < "$TOYBOX_BLOCKED"
        if [ -n "$TOYBOX_HITS" ]; then
            printf "\\nThe Toy Box: Commit blocked.\\nThese files are in \\"Blocked Changes\\":\\n%b\\n" "$TOYBOX_HITS"
            printf "Unblock them via the Source Control view before committing.\\n\\n"
            exit 1
        fi
    fi
fi
${HOOK_END}
`;

const LEGACY_PRE_COMMIT_HOOK_SNIPPET = PRE_COMMIT_HOOK_SNIPPET.replace(
	`${HOOK_END}\n`,
	"",
);

function getHookPath(root: string): string {
	return path.join(root, ".git", "hooks", "pre-commit");
}

export function ensurePreCommitHook(root: string): void {
	const target = getHookPath(root);
	if (!fs.existsSync(path.dirname(target))) {
		return;
	}
	try {
		if (!fs.existsSync(target)) {
			fs.writeFileSync(target, `#!/bin/sh\n${PRE_COMMIT_HOOK_SNIPPET}`, { mode: 0o755 });
			return;
		}
		const existing = fs.readFileSync(target, "utf8");
		if (existing.includes(LEGACY_PRE_COMMIT_HOOK_SNIPPET) && !existing.includes(HOOK_END)) {
			fs.writeFileSync(
				target,
				existing.replace(LEGACY_PRE_COMMIT_HOOK_SNIPPET, PRE_COMMIT_HOOK_SNIPPET),
				{ mode: 0o755 },
			);
		} else if (!existing.includes(HOOK_START)) {
			fs.writeFileSync(target, `${existing.trimEnd()}\n\n${PRE_COMMIT_HOOK_SNIPPET}`, { mode: 0o755 });
		}
	} catch {
		// Hook setup is intentionally non-fatal.
	}
}

export function removePreCommitHook(root: string): void {
	const target = getHookPath(root);
	try {
		if (!fs.existsSync(target)) {
			return;
		}
		const existing = fs.readFileSync(target, "utf8");
		const start = existing.indexOf(HOOK_START);
		const endMarker = existing.indexOf(HOOK_END, start);
		if (start < 0 || endMarker < 0) {
			return;
		}
		const updated = `${existing.slice(0, start).trimEnd()}\n${existing.slice(endMarker + HOOK_END.length).trimStart()}`.trimEnd();
		if (updated === "" || updated === "#!/bin/sh") {
			fs.unlinkSync(target);
		} else {
			fs.writeFileSync(target, `${updated}\n`, { mode: 0o755 });
		}
	} catch {
		// Hook cleanup is intentionally non-fatal.
	}
}
