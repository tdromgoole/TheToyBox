# Change Log

All notable changes to the "theToyBox" extension will be documented in this file.

## [0.0.14]

- **Bug Fix**: **Better Outline — Markdown headings no longer show hash symbols** — the `#` prefix characters are no longer included in the heading label displayed in the outline panel.
- **Bug Fix**: **Better Outline — Markdown headings are no longer collapsible** — heading rows now always keep their children visible and clicking a heading jumps to it, rather than toggling expand/collapse.

## [0.0.13]

- **New Feature**: **Markdown Heading Highlights** — each heading level (`#` through `######`) in Markdown files is now color-highlighted in the editor. Six colors (one per level) are configurable via `theToyBox.markdownHeadings.colors`. Background color and full-line vs. text-only highlight are also toggleable.
- **New Feature**: **Markdown Heading Outline** — opening a Markdown file now populates the Better Outline panel with a nested heading tree, color-matched to the configured heading colors.
- **New Feature**: **Markdown Preview enable/disable** — `theToyBox.markdownPreview.enabled` toggles both the custom webview command and the built-in preview alert rendering in real time.
- **New Feature**: **Custom alert headings** — Markdown alerts now support an optional custom title: `[!NOTE][My Custom Title]` replaces the default "Note" label with your own text. Works in both the built-in preview and the custom webview.
- **New Feature**: **Indent Rainbow opacity setting** — `theToyBox.indentRainbowOpacity` accepts a percentage (1–100, default 10) and is applied in real time when changed.
- **New Feature**: **Custom Comments excluded file types** — `theToyBox.customComments.excludedFileTypes` (default `[".md"]`) lists extensions that skip custom comment highlighting. The Better Outline panel respects this same list.
- **Bug Fix**: **Custom Comments — `#` prefix no longer flags regex literals** — JavaScript, TypeScript, HTML, XML, and CSS files no longer treat `#` as a comment prefix, so patterns like `/^## heading/` are no longer incorrectly highlighted.
- **Bug Fix**: **Indent Rainbow opacity change now applies in real time** — the config listener was only watching `theToyBox.indentRainbow`, not `theToyBox.indentRainbowOpacity`, so opacity changes required a reload. Both settings are now watched.

## [0.0.12]

- **Bug Fix**: **Better Outline — Collapse/Expand buttons no longer duplicated** — buttons were contributed via `view/title` in a single-view activity bar container, causing VS Code to render them twice. Commands are now registered once in the factory function instead of inside `resolveWebviewView`, and `postToWebview` is exposed as a public method so handlers always reference the live provider instance.
- **Bug Fix**: **Spaces-to-tabs conversion now writes to disk on save** — the save listener was using `onDidSaveTextDocument` which fires after the file is already written, so converted tabs appeared in the buffer but were never persisted. Switched to `onWillSaveTextDocument` + `event.waitUntil()` so edits are injected directly into the save pipeline.
- **Bug Fix**: **Spaces-to-tabs conversion respects the file's actual indentation unit** — the converter previously divided by `editor.tabSize`, so 2-space-indented files with `tabSize=4` never converted (`Math.floor(2/4)=0`). It now detects the minimum qualifying space width (≥2) scoped to the lines being processed, giving the correct unit regardless of editor settings.
- **Bug Fix**: **Spaces-to-tabs conversion preserves indent hierarchy when pasting code** — converting pasted code with irregular space widths now produces the fewest tabs needed. The minimum space width in the processed range is used as the base unit, so e.g. 3/6/9 spaces → 1/2/3 tabs correctly.
- **Bug Fix**: **Tab/trailing-whitespace edits no longer corrupt code** — two separate edits (one for leading whitespace, one for trailing) were both computed from original character positions. If the leading replace shortened the line first, the trailing delete's positions became stale and could land inside code content. Both transformations are now applied in-memory and emitted as a single `replace` per line.
- **Enhancement**: **Indent Rainbow colors updated to pastels at 10% opacity** — replaced the saturated rainbow palette with soft alternating warm/cool pastel tones (pink, sky blue, peach, lavender, rose, mint, yellow, periwinkle, blush, sage, mauve, lilac) at 10% opacity for a subtle, non-distracting indent guide.
- **Enhancement**: **Indent Rainbow colors no longer user-configurable** — the `theToyBox.indentRainbow.colors` setting has been removed; colors are now hardcoded to the curated pastel palette.

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
