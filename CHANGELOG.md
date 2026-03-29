# Change Log

All notable changes to the "theToyBox" extension will be documented in this file.

## [0.0.11]

- **Bug Fix**: **Spaces-to-Tabs conversion now handles all leading whitespace** — the regex was previously anchored to pure-space lines, leaving spaces behind on lines that began with a tab. The converter now processes any mixed tab/space leading whitespace, computes the correct effective width using proper tab-stop arithmetic, and preserves sub-tab-width remainders as spaces so indentation depth is never silently lost.
- **Bug Fix**: **Custom Comments config namespace corrected** — `updateComments` was reading settings from `'customComments'` instead of `'theToyBox.customComments'`, causing the `fullLineHighlight` setting to always fall back to its hardcoded default and ignore the user's preference.
- **Bug Fix**: **`cleanOnSave` default aligned with `package.json`** — the save listener was using `false` as its fallback, contradicting the `"default": true` declared in the extension manifest.
- **Bug Fix**: **Better Outline commands no longer throw "already registered" errors** — `betterOutline.collapseAll` and `betterOutline.expandAll` were registered inside `resolveWebviewView` without a guard, causing duplicate registration errors if the panel was closed and reopened.
- **Bug Fix**: **Better Outline event listeners no longer leak** — `onDidChangeActiveTextEditor`, `onDidChangeTextDocument`, and `onDidChangeTextEditorSelection` subscriptions created in `resolveWebviewView` are now tracked and disposed via `context.subscriptions`.
- **Bug Fix**: **Trailing-spaces decoration type is now properly disposed** — the `TextEditorDecorationType` for trailing-space highlighting is now registered with `context.subscriptions` so VS Code cleans it up on extension deactivation.

## [0.0.10]

- **Bug Fix**: **Better Outline — Collapse/Expand now works correctly** — clicking a region row reliably toggles its children open or closed.
- **Bug Fix**: **Better Outline — SQL/PHP collapse/expand** — regions in SQL files now correctly display their contained tables, views, procedures, and functions as collapsible children.
- **Bug Fix**: **Better Outline — Items inside regions no longer duplicated at root level** — SQL entities and PHP functions owned by a `#region` no longer also appear as standalone root items.
- **Enhancement**: **Indent Rainbow color picker** — the `theToyBox.indentRainbow.colors` setting now shows a color swatch and color picker in the VS Code Settings UI.

## [0.0.9]

- **New Feature**: **GitHub-Style Markdown Alerts** — `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` blockquotes now render as styled callout boxes in the built-in Markdown preview.
- **New Feature**: **PHP Function Detection** in Better Outline — PHP functions (`public`, `private`, `protected`, `static`) are now detected and displayed with a Function icon.
- **Enhancement**: **Material Symbols icons** bundled locally — icons in the Better Outline and Markdown alerts no longer require an internet connection.
- **Enhancement**: **Custom Markdown Preview** command (`The Toy Box: Open Markdown Preview with Alerts`) for a standalone dark-themed preview panel.
- **Bug Fix**: Custom comment detection no longer incorrectly flags PHP variable references like `$varName` as custom comments.

## [0.0.8]

- **New Feature**: Added **JSON Formatter** to pretty-print minified JSON selections.
- **Enhancement**: Improved "Align Equals" logic for even more precise visual tab-stop snapping.

## [0.0.7]

- **New Feature**: Added **"Align Equals with Tabs"** command to vertically align variable assignments.
- **SQL & PostgreSQL Support**: Native detection for Tables, Views, Procedures, and Functions in the outline.
- **Label Mapping**: Added settings to replace comment symbols with custom words in the sidebar.
- **String-Safe Logic**: Enhanced scanner to ignore SQL string literals and temp tables.
