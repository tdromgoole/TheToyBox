# Extension Improvement Plan

This document tracks issues identified during the extension-wide review. Items are ordered by priority and can be completed independently unless a dependency is noted.

## Current verification baseline

- [x] TypeScript and webpack build succeeds.
- [x] All 128 automated tests pass.
- [x] ESLint reports 0 errors and 40 warnings.
- [x] Production dependency audit reports 0 known vulnerabilities.
- [x] Full dependency audit reports 11 development-only findings: 7 high, 3 moderate, and 1 low.

## Priority 1: Packaging, security, and unavailable features

### 1. Package Mermaid with the extension

Problem: `src/printer.ts` loads `node_modules/mermaid/dist/mermaid.min.js`, while `.vscodeignore` excludes `node_modules/**`. Mermaid can work in the Extension Development Host but fail in an installed VSIX.

- [x] Copy the Mermaid browser bundle into `dist/assets/mermaid.min.js` during the build.
- [x] Update the print webview to load that packaged asset.
- [x] Add a build/package check that verifies the packaged asset exists and matches the installed Mermaid bundle.
- [ ] Verify the asset appears in the final VSIX file list.
- [ ] Test Mermaid printing from an installed VSIX, not only the debugger.

Acceptance criteria: Mermaid diagrams render from both the Extension Development Host and an installed VSIX without network access.

### 2. Make HTML printing safe by default

Problem: HTML printing enables scripts and removes the source document's Content Security Policy. Printing an untrusted HTML file can therefore execute its scripts and make network requests.

- [ ] Decide whether HTML printing requires any source-document JavaScript.
- [ ] Strip source scripts and inline event handlers for normal static printing.
- [ ] Apply an extension-controlled restrictive CSP with a nonce for the serializer only.
- [ ] If scripted documents must be supported, put that behavior behind an explicit trust warning or setting.
- [ ] Add tests for inline scripts, remote scripts, event handlers, and CSP behavior.

Acceptance criteria: printing ordinary HTML does not execute source-document scripts or permit unexpected network access.

### 3. Restore or retire Scratch Pad

Problem: `src/scratchPad.ts` implements Scratch Pad, and the README documents it, but activation and the extension manifest do not expose it.

- [ ] Confirm that Scratch Pad remains a supported feature.
- [ ] If supported, register its provider during activation.
- [ ] Add the required view, commands, menus, and configuration to `package.json`.
- [ ] Add activation and persistence tests.
- [ ] If it is no longer supported, remove the dead implementation and update the README and changelog.

Acceptance criteria: the documented feature is usable and tested, or it is removed consistently from code and documentation.

## Priority 2: Functional reliability

### 4. Make Blocked Changes registration reliable

Problem: activation waits for `vscode.extensions.onDidChange` when the built-in Git extension is not active. That event is not a dependable notification of Git activation.

- [ ] Activate the built-in Git extension directly, or register commands immediately and retrieve its API lazily.
- [ ] Handle Git being unavailable without preventing unrelated extension features from loading.
- [ ] Add tests for already-active, initially-inactive, and unavailable Git states.

Acceptance criteria: Blocked Changes becomes available consistently without reinstalling extensions or reloading the window.

### 5. Support multi-root workspaces in Blocked Changes

Problem: `src/blockedChanges.ts` always uses `workspaceFolders[0]`, even when the selected file belongs to another repository.

- [ ] Resolve the owning root with `vscode.workspace.getWorkspaceFolder(uri)`.
- [ ] Store blocked-file state independently for each workspace root.
- [ ] Apply Git and hook operations only to the owning repository.
- [ ] Reject files outside all workspace roots safely.
- [ ] Add multi-root tests covering two independent Git repositories.

Acceptance criteria: actions on a file never modify the metadata or hooks of a different workspace folder.

### 6. Add integrity verification to font installation

Problem: the font installer downloads the latest release archive and installs it without verifying a checksum or signature.

- [ ] Pin or otherwise identify the intended release deterministically.
- [ ] Publish or maintain expected SHA-256 checksums.
- [ ] Verify the downloaded archive before extraction or installation.
- [ ] Abort with a clear error on a checksum mismatch.
- [ ] Replace shell-oriented process invocation with `execFile` and separated arguments where practical.
- [ ] Add tests for valid downloads, redirects, oversized responses, invalid archives, and checksum mismatches.

Acceptance criteria: downloaded fonts are installed only after their origin and contents pass validation.

### 7. Allow Shiki initialization to recover

Problem: `src/shikiHighlighter.ts` caches the initialization promise. If initialization fails once, every later attempt fails until the extension host reloads.

- [ ] Clear the cached promise when initialization rejects.
- [ ] Preserve the current plain-text fallback behavior.
- [ ] Add a test where initialization fails once and succeeds on retry.

Acceptance criteria: a transient initialization failure does not permanently disable highlighting for the session.

## Priority 3: Regression protection

### 8. Add PDF and Markdown fixture tests

- [ ] Create representative fixtures for alerts, headings, task lists, code blocks, tables, images, and Mermaid.
- [ ] Test both standard GitHub alert syntax and supported Toy Box shorthand.
- [ ] Verify PDF block ordering and that alert bodies remain inside their containers.
- [ ] Verify heading margins, rules, and page-boundary behavior.
- [ ] Verify task-list checkboxes appear as vector or printable checkbox marks.
- [ ] Verify Shiki output for PHP, shell, JSON, SQL, and an unknown language fallback.
- [ ] Add a large combined-document regression fixture.

Acceptance criteria: the rendering regressions fixed during the 1.1.9 work are detected automatically.

### 9. Add packaged-extension smoke tests

- [ ] Generate a VSIX in CI or the release validation script.
- [ ] List and verify required runtime files and dynamic Shiki chunks.
- [ ] Install the VSIX into a clean test profile.
- [ ] Run a minimal Markdown-to-PDF test from the installed extension.

Acceptance criteria: release validation exercises the same packaged files users receive.

### 10. Expand feature integration coverage

- [ ] Test Quick Notes persistence and malformed saved state.
- [ ] Test Session Restore lifecycle behavior.
- [ ] Test webview message validation for every provider.
- [ ] Test Blocked Changes hook installation and removal without overwriting unrelated hooks.
- [ ] Test extension deactivation and disposable cleanup.

## Priority 4: Build and maintenance

### 11. Clean webpack output before builds

Problem: Shiki produces many dynamic chunks, while webpack does not currently clean `dist`. Old hashed chunks can accumulate and be packaged accidentally.

- [ ] Set `output.clean: true` in `webpack.config.js`.
- [ ] Confirm required static assets are retained or copied after cleaning.
- [ ] Measure the resulting VSIX size and inspect its file list.

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

- [ ] Review the dependency paths reported by `npm audit`.
- [ ] Apply non-breaking upgrades first.
- [ ] Evaluate breaking upgrades individually rather than using a blind forced audit fix.
- [ ] Rerun the build, tests, lint, and package smoke tests after upgrading.

Acceptance criteria: development advisories are eliminated or explicitly documented with rationale and mitigations.

### 14. Reduce lint debt

- [ ] Fix the 40 current warnings, prioritizing loose inequality and missing-brace warnings in changed code.
- [ ] Consider making CI fail on new warnings with `--max-warnings=0` after the baseline is clean.

Acceptance criteria: lint completes with no errors or warnings.

## Priority 5: API and lifecycle cleanup

### 15. Keep test helpers out of the public extension API

Problem: activation currently exposes rendering and highlighting helpers primarily for tests, unintentionally expanding the extension API.

- [ ] Test the pure renderer and highlighter modules directly where possible.
- [ ] Remove test-only functions from the activation return value, or place them behind a clearly internal test seam.
- [ ] Document any API that is intentionally public.

### 16. Complete timer and disposable cleanup

- [ ] Clear the typing debounce timer during deactivation.
- [ ] Audit providers, listeners, panels, output channels, and watchers for proper disposal.
- [ ] Add a lifecycle test that activates and deactivates the extension without leaving callbacks running.

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

- [ ] Compile succeeds.
- [ ] Unit and integration tests pass.
- [ ] ESLint passes with the accepted warning threshold.
- [ ] Production dependency audit is clean.
- [ ] Development dependency findings are resolved or documented.
- [ ] VSIX content has been inspected.
- [ ] Mermaid and Shiki work from an installed VSIX.
- [ ] Representative Markdown prints correctly to PDF.
- [ ] README, changelog, manifest, and version agree.
