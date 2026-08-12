# Extension Improvement Plan

This document tracks issues identified during the extension-wide review. Items are ordered by priority and can be completed independently unless a dependency is noted.

## Current verification baseline

- [x] TypeScript and webpack build succeeds.
- [x] All 162 automated test cases pass.
- [x] ESLint reports 0 errors and 0 warnings.
- [x] Production dependency audit reports 0 known vulnerabilities.
- [x] Full dependency audit reports 0 known vulnerabilities.

## Priority 1: Packaging, security, and unavailable features

### 1. Package Mermaid with the extension

Problem: `src/printer.ts` loads `node_modules/mermaid/dist/mermaid.min.js`, while `.vscodeignore` excludes `node_modules/**`. Mermaid can work in the Extension Development Host but fail in an installed VSIX.

- [x] Copy the Mermaid browser bundle into `dist/assets/mermaid.min.js` during the build.
- [x] Update the print webview to load that packaged asset.
- [x] Add a build/package check that verifies the packaged asset exists and matches the installed Mermaid bundle.
- [x] Verify the asset appears in the final VSIX file list.
- [x] Test Mermaid printing from an installed VSIX, not only the debugger.

Acceptance criteria: Mermaid diagrams render from both the Extension Development Host and an installed VSIX without network access.

### 2. Make HTML printing safe by default

Problem: HTML printing enables scripts and removes the source document's Content Security Policy. Printing an untrusted HTML file can therefore execute its scripts and make network requests.

- [x] Decide whether HTML printing requires any source-document JavaScript. Static HTML printing does not.
- [x] Strip source scripts and inline event handlers for normal static printing.
- [x] Apply an extension-controlled restrictive CSP with a nonce for the serializer only.
- [x] Scripted source documents are intentionally unsupported; no unsafe compatibility setting is exposed.
- [x] Add tests for inline scripts, remote scripts, event handlers, and CSP behavior.

Acceptance criteria: printing ordinary HTML does not execute source-document scripts or permit unexpected network access.

### 3. Retire Scratch Pad

Problem: `src/scratchPad.ts` implements Scratch Pad, and the README documents it, but activation and the extension manifest do not expose it.

- [x] Confirm that Scratch Pad is retired in favor of Quick Notes.
- [x] Confirm no provider, view, commands, menus, or configuration expose the feature.
- [x] Remove the dead implementation and marketplace keyword.
- [x] Confirm the current README does not document Scratch Pad.
- [x] Record the retirement in the changelog while retaining historical release notes.

Acceptance criteria: the documented feature is usable and tested, or it is removed consistently from code and documentation.

## Priority 2: Functional reliability

### 4. Make Blocked Changes registration reliable

Problem: activation waits for `vscode.extensions.onDidChange` when the built-in Git extension is not active. That event is not a dependable notification of Git activation.

- [x] Register commands immediately and retrieve the built-in Git API lazily.
- [x] Handle Git being unavailable without preventing unrelated extension features from loading.
- [x] Verify Blocked Changes commands register without activating or consulting `vscode.git` by running a dedicated Extension Test Host with the built-in Git extension disabled.

Acceptance criteria: Blocked Changes becomes available consistently without reinstalling extensions or reloading the window.

### 5. Support multi-root workspaces in Blocked Changes

Problem: `src/blockedChanges.ts` always uses `workspaceFolders[0]`, even when the selected file belongs to another repository.

- [x] Resolve the owning root with `vscode.workspace.getWorkspaceFolder(uri)`.
- [x] Store blocked-file state independently for each workspace root.
- [x] Apply Git and hook operations only to the owning repository.
- [x] Reject files outside all workspace roots safely.
- [x] Add a multi-root integration test covering two independent Git repositories.

Acceptance criteria: actions on a file never modify the metadata or hooks of a different workspace folder.

### 6. Add integrity verification to font installation

Problem: the font installer downloads the latest release archive and installs it without verifying a checksum or signature.

- [x] Pin or otherwise identify the intended release deterministically.
- [x] Maintain the expected SHA-256 checksum from the upstream release.
- [x] Verify the downloaded archive before extraction or installation.
- [x] Abort with a clear error on a checksum mismatch.
- [x] Replace shell-oriented process invocation with `execFile` and separated arguments where practical.
- [x] Add tests for valid downloads, redirects, oversized responses, invalid archives, and checksum mismatches.

Acceptance criteria: downloaded fonts are installed only after their origin and contents pass validation.

### 7. Allow Shiki initialization to recover

Problem: `src/shikiHighlighter.ts` caches the initialization promise. If initialization fails once, every later attempt fails until the extension host reloads.

- [x] Clear the cached promise when initialization rejects.
- [x] Preserve the current plain-text fallback behavior.
- [x] Add a test where initialization fails once and succeeds on retry.

Acceptance criteria: a transient initialization failure does not permanently disable highlighting for the session.

## Priority 3: Regression protection

### 8. Add PDF and Markdown fixture tests

- [x] Create representative fixtures for alerts, headings, task lists, code blocks, tables, images, and Mermaid.
- [x] Test both standard GitHub alert syntax and supported Toy Box shorthand.
- [x] Verify PDF block ordering and that alert bodies remain inside their containers.
- [x] Verify heading margins, rules, and page-boundary behavior.
- [x] Verify task-list checkboxes appear as vector or printable checkbox marks.
- [x] Verify Shiki output for PHP, shell, JSON, SQL, and an unknown language fallback.
- [x] Add a large combined-document regression fixture.

Acceptance criteria: the rendering regressions fixed during the 1.1.9 work are detected automatically.

### 9. Add packaged-extension smoke tests

- [x] Generate a VSIX in the release validation script.
- [x] List and verify required runtime files and dynamic Shiki chunks.
- [x] Install the VSIX into a clean test profile.
- [x] Run a minimal Markdown-to-PDF test from the installed extension.

Acceptance criteria: release validation exercises the same packaged files users receive.

### 10. Expand feature integration coverage

- [x] Test Quick Notes persistence and malformed saved state.
- [x] Test Session Restore lifecycle behavior.
- [x] Test webview message validation for every provider.
- [x] Test Blocked Changes hook installation and removal without overwriting unrelated hooks.
- [x] Test extension deactivation and disposable cleanup.

## Priority 4: Build and maintenance

### 11. Clean webpack output before builds

Problem: Shiki produces many dynamic chunks, while webpack does not currently clean `dist`. Old hashed chunks can accumulate and be packaged accidentally.

- [x] Set `output.clean: true` in `webpack.config.js`.
- [x] Confirm required static assets are retained or copied after cleaning.
- [x] Measure the resulting VSIX size and inspect its file list (3.01 MB, 313 files, 303 Shiki chunks).

Acceptance criteria: consecutive clean builds produce the same required file set without stale chunks.

### 12. Update release metadata and documentation

- [x] Choose the next extension version.
- [x] Document alert compatibility and layout changes.
- [x] Document local Mermaid rendering.
- [x] Document Shiki-based PDF syntax highlighting and fallback behavior.
- [x] Document task-list, heading, and preparing-overlay changes.
- [x] Ensure README feature claims match registered commands and views.
- [x] Update `CHANGELOG.md`, `package.json`, and `package-lock.json` together.

Acceptance criteria: the manifest, README, and changelog accurately describe the packaged release.

### 13. Resolve development dependency advisories

- [x] Review the dependency paths reported by `npm audit`.
- [x] Apply non-breaking upgrades first.
- [x] Evaluate and pin the remaining patched Mocha transitive dependencies without a forced audit fix.
- [x] Rerun the build, tests, lint, audits, and package smoke tests after upgrading.

Acceptance criteria: development advisories are eliminated or explicitly documented with rationale and mitigations.

### 14. Reduce lint debt

- [x] Fix the 40 current warnings, prioritizing loose inequality and missing-brace warnings in changed code.
- [x] Make CI fail on new warnings with `--max-warnings=0` after cleaning the baseline.

Acceptance criteria: lint completes with no errors or warnings.

## Priority 5: API and lifecycle cleanup

### 15. Keep test helpers out of the public extension API

Problem: activation currently exposes rendering and highlighting helpers primarily for tests, unintentionally expanding the extension API.

- [x] Test the pure renderer and highlighter modules directly where possible.
- [x] Remove test-only functions from the activation return value.
- [x] Keep and document `extendMarkdownIt` as the intentional Markdown-extension API.

### 16. Complete timer and disposable cleanup

- [x] Clear the typing debounce timer during deactivation.
- [x] Audit providers, listeners, panels, output channels, and watchers for proper disposal.
- [x] Add lifecycle coverage proving disposed timers leave no callbacks running.

## Suggested implementation order

1. Package Mermaid and add the VSIX smoke test.
2. Secure HTML printing.
3. Decide and resolve Scratch Pad status.
4. Fix Blocked Changes activation and multi-root behavior together.
5. Add font archive verification.
6. Add Shiki retry handling.
7. Build the PDF/Markdown regression suite.
8. Clean webpack output and dependency advisories.
9. Complete documentation, versioning, lint, API, and lifecycle cleanup.

## Release checklist

- [x] Compile succeeds.
- [x] Unit and integration tests pass.
- [x] ESLint passes with zero warnings.
- [x] Production dependency audit is clean.
- [x] Development dependency audit is clean.
- [x] VSIX content has been inspected.
- [x] Mermaid and Shiki packaged assets work from an installed VSIX.
- [x] Representative Markdown prints correctly to PDF.
- [x] README, changelog, manifest, and version agree.
