# Change Log

All notable changes to the "theToyBox" extension will be documented in this file.

## [0.0.24]

- **New Feature**: **Better Outline — nginx Support** — Opening an nginx configuration file (`.conf` or language ID `nginx`) now populates the Better Outline panel with a hierarchical tree of block directives (`http`, `server`, `location`, `upstream`, `events`, `stream`, `map`, `if`, etc.) and notable leaf directives (`listen`, `server_name`, `proxy_pass`, `root`, `rewrite`, `return`, `include`, `ssl_certificate`, `try_files`, etc.). Each block type has a distinct icon. `#region` / `#endregion` markers are supported.
- **New Feature**: **Better Outline — JavaScript / TypeScript Dedicated Parser** — JS/TS/JSX/TSX outline support has been extracted into a self-contained `parseJs` module. All existing functionality is preserved: named functions, arrow functions, classes (TS only), jQuery `.on()` and `.delegate()` handlers, custom comment nesting, `#region` markers, and language server symbol enrichment.
- **New Feature**: **Better Outline — YAML Support** — Opening a YAML file produces a nested outline tree based on indentation. Mapping keys that have child content are shown as collapsible regions; scalar key-value pairs display their value inline (e.g. `name: my-app`). Handles quoted keys, merge keys (`<<`), block scalars (`|`, `>`), comments, and document separators.
- **New Feature**: **Better Outline — INI / Properties Support** — Opening an INI, `.cfg`, `.env`, or properties file shows `[section]` headers as collapsible parent nodes with `key = value` pairs nested as children. Comments (`;` and `#`) are skipped.
- **New Feature**: **Better Outline — JSON / JSONC Support with Adaptive Depth** — Opening a JSON or JSONC file produces a full structural outline. Objects are collapsible, arrays show indexed children (with a smart label when elements contain a `name`, `id`, `title`, `key`, `label`, or `type` field), and scalar values display inline previews. For large files the parser automatically reduces depth to keep the panel responsive: full detail for files ≤ 1,000 lines, depth 4 for files ≤ 10,000 lines, and depth 2 for larger files. JSONC `//` and `/* */` comments are handled.
- **Refactor**: **collectEntities Cleanup** — The `findJqueryHandlerEnd` helper, all TS/JS detection code, and the `tsJsItems` field have been removed from `collectEntities.ts` now that JS/TS has its own dedicated parser. The shared scanner now only handles PHP functions, SQL entities, and comments.

## [0.0.23]

- **New Feature**: **nginx Syntax Highlighting** — Decoration-based syntax highlighting for nginx configuration (`.conf`) files. Tokens: `keyword` (directives, blue), `nginxBlock` (block names before `{`, teal bold), `nginxVariable` (`$variables`, light blue), `comment`, `string`, and `number` (with optional `k`/`m`/`g` suffixes). Toggle with `theToyBox.syntaxHighlighting.nginx`.
- **New Feature**: **nginx Hover Documentation** — Hovering over any nginx directive shows its syntax, default value, and a short description. Hovering over a `$variable` shows what it contains. Covers ~100 directives and ~80 built-in variables. Respects both the master `enabled` setting and the per-language `nginx` toggle.
- **New Feature**: **Classic ASP / VBScript Hover Documentation** — Hovering over a VBScript keyword shows its syntax and a usage example (~60 keywords covered). Hovering over one of the six built-in ASP objects (`Response`, `Request`, `Server`, `Session`, `Application`, `Err`) lists all key methods and properties. Respects both the master `enabled` setting and the `asp` toggle.
- **Bug Fix**: **Extension Startup Activation** — Added `onStartupFinished` to `activationEvents` so that syntax highlighting and hover documentation activate correctly when a `.conf` or other non-language-mapped file is already open at VS Code launch. A 500 ms startup pass now iterates all visible editors to apply decorations immediately.

## [0.0.22]

- **New Feature**: **T-SQL Highlighting in PHP Strings** — T-SQL keywords (`DECLARE`, `SELECT`, `GO`, `BEGIN`/`END`, …), data types (`VARCHAR`, `INT`, `DATETIME`, …), built-in functions (`GETDATE`, `ISNULL`, `COUNT`, …), and `@variables` are now highlighted inside PHP double-quoted strings. Toggle with `theToyBox.syntaxHighlighting.phpSql`.
- **New Feature**: **T-SQL Highlighting in JavaScript / TypeScript Strings** — the same T-SQL token colors apply inside JS/TS double-quoted strings, single-quoted strings, and template literals (`` ` ``), including `${…}` interpolation awareness. Toggle with `theToyBox.syntaxHighlighting.jsSql`.
- **Refactor**: **Shared SQL Scanner** — keyword sets and the core SQL token scanner are extracted into `sqlScanner.ts` and shared by both tokenizers. Adding a new SQL keyword or function only requires a single edit.

## [0.0.21]

- **Bug Fix**: **Syntax Highlighting — `enabled` setting now correctly disables highlighting** — `theToyBox.syntaxHighlighting.enabled` was documented and present in the settings UI since v0.0.19 but never consulted at runtime. `refreshSyntaxHighlighting()` always recreated all decoration types regardless of the setting value, so toggling it off had no effect. The function now reads the `enabled` flag first and leaves the internal `decorations` map empty when the toggle is off, making `updateSyntaxHighlighting()` a no-op — consistent with how every other toggleable feature in the extension behaves.
- **Bug Fix**: **Better Outline — comment scanner now applies per-language prefix filtering** — the single-pass entity collector used a fixed set of comment prefixes (`//`, `--`, `#`, `%`, `'`) for every language, diverging from the filtering already applied by the custom comment highlighter. This caused false-positive outline comment items (e.g., JS shebang lines `#!/usr/bin/env node` being treated as comments, or SQL-style `'` openers in languages where `'` is a string delimiter). The collector now applies the same rules as `customComments.ts`: `'` is excluded for PHP, JavaScript, TypeScript, and SQL variants; `#` is excluded for JavaScript, TypeScript, HTML, XML, and CSS. Prefixes are also sorted longest-first to prevent shorter prefixes shadowing longer ones.

## [0.0.19]

- **New Feature**: **Decoration-Based Syntax Highlighting** — a new syntax highlighting engine applies VS Code Dark+-style token colors to file types that lack a grammar extension. Three languages are supported in this release:
    - **KDL Document Language** (`.kdl`) — highlights node names, property keys, type annotations `(u8)`, quoted and raw strings, numbers (decimal, hex, octal, binary, float), booleans/null, and line/block/slashdash comments. Enabled by default; toggled with `theToyBox.syntaxHighlighting.enabled`.
    - **Classic ASP / VBScript** (`.asp`) — dual-mode tokenizer covering HTML tags, attributes, and strings in the HTML sections, plus VBScript keywords, strings, numbers, and comments inside `<% %>` blocks. Toggle with `theToyBox.syntaxHighlighting.asp`.
    - **ASP.NET Razor VB** (`.vbhtml`) — three-tier tokenizer with teal built-in types (`Integer`, `String`, `Boolean`, …), blue control-flow keywords, gold `@` delimiters, italic-tan Razor directives (`@model`, `@using`, `@section`, …), and salmon HTML attributes. Toggle with `theToyBox.syntaxHighlighting.razorVb`.
- **Enhancement**: **Better Outline — KDL Support** — opening a `.kdl` file now populates the Better Outline panel with a hierarchical node tree. Each node is labelled as `nodeName key value` using its name and the first argument or property on the line (quotes and `=` are stripped for readability). Nodes that open a `{` children block become collapsible regions; closing `}` lines are consumed transparently.

## [0.0.18]

- **New Feature**: **CSS / SCSS / Less Outline** — the Better Outline panel now parses CSS, SCSS, and Less files. Detected constructs include element selectors, `.class` selectors, `#id` selectors, custom properties (`--var`), `@media` queries, `@keyframes` blocks, and generic at-rules. Each has a distinct Material Symbols icon. `#region` / `#endregion` comments create collapsible folders in the same way as all other supported languages.
- **New Feature**: **Word Frequency Panel** — a new sidebar panel lists every unique word/token in the active file sorted by frequency. Click any row to expand it and reveal clickable line-number chips, each of which jumps the cursor to that exact occurrence. A filter box narrows the list in real time. Toggle with `theToyBox.wordFrequency.enabled`.
- **Enhancement**: **Better Outline — Highlight on Click** — clicking an outline item now briefly flashes the target line in the editor using the theme's find-match highlight color, making it easy to spot where the cursor landed. Controlled by the new `theToyBox.outline.highlightOnClick` setting (default `true`).
- **Enhancement**: **Better Outline — Empty State Message** — when a file has no symbols (unsupported language, no language extension installed), the outline now shows a `manage_search` icon and the message "No symbols found — a language extension may be needed" instead of a blank panel.
- **Security**: **Font Installer — Network Timeout** — the GitHub API call in `getLatestNerdFontsVersion` and the font download request in `downloadFile` now both carry a 10-second socket timeout. Previously a slow or unreachable server would cause the command to hang indefinitely; it now falls back to the bundled version string automatically.
- **Security**: **Markdown Webview CSP — Removed `script-src 'unsafe-inline'`** — the Content Security Policy for the custom Markdown preview webview contained `script-src 'unsafe-inline'` despite the webview containing no `<script>` tags. The directive has been removed so the CSP is now strictly `default-src 'none'` plus the necessary `style-src` and `font-src` allowances.

## [0.0.17]

- **New Feature**: **Space-Based Indent Rainbow** — indent rainbow coloring now works for space-indented files (Python, YAML, etc.), not just tab-indented files. Each group of `tabSize` leading spaces is colored as one indentation level, using the editor's own tab size setting.
- **New Feature**: **Configurable Indent Rainbow Colors** — added `theToyBox.indentRainbowColors` setting. Provide a custom `string[]` of hex colors (e.g. `["#FF6B6B", "#FFD93D"]`) to replace the built-in pastel palette. Leave empty to keep the default colors. Changes apply in real time.
- **New Feature**: **Multi-Operator Code Alignment** — the "Align with Tabs" command now supports five operators: `=` (assignment), `:` (object keys), `=>` (fat arrow / PHP arrays), `+=`, and `-=`. The operator is **auto-detected** from the selection (more specific operators take priority, e.g. `=>` before `=`), so no picker appears for unambiguous selections. A QuickPick fallback is shown only when no operator is found.
- **New Feature**: **JavaScript / TypeScript Outline Specialization** — the Better Outline panel now detects JS/TS-specific constructs:
    - Named `function` declarations
    - Arrow function expressions (`const foo = () =>`)
    - ES6 `class` declarations (TypeScript/TSX only)
    - jQuery `.on()` event handlers — displayed as `selector.Event` with a class or ID icon
    - jQuery `.delegate()` event handlers — displayed as `selector.Event.Delegate`
- **New Feature**: **JavaScript Outline — Comments Nested Inside Functions** — custom comments found within a function or jQuery handler body are now displayed as indented children of that function in the outline panel. The function item becomes collapsible.
- **Enhancement**: **Better Outline — Clicking Any Item Navigates to Its Line** — collapsible items (functions, regions, etc.) now both toggle their children AND jump to the line in the editor on click. Previously, clicking a collapsible item only toggled expand/collapse.
- **Enhancement**: **Better Outline — JS Files Show Only Functions, jQuery Handlers, and Comments** — language server symbols (variables, imports, etc.) are suppressed in `.js`/`.jsx` files to reduce noise. TypeScript files retain full language server output.
- **Bug Fix**: **Better Outline — Correct Icon for Functions With Nested Comments** — when a JS function gained nested comments, `isRegion` was set to `true`, causing `getIcon()` to return a folder icon before reaching the `tsJsType` checks. Specific type checks (`tsJsType`, `phpType`, `sqlType`) now take priority over the generic region folder fallback.
- **Bug Fix**: **Better Outline — JS Functions No Longer Hidden After LS Enrichment** — the language server enrichment step was calling `claimedLines.add(item.line)` for every JS function it matched. Since the final assembly filters with `!claimedLines.has(t.line)`, this caused many functions to be silently removed. For JS files, `claimedLines` is no longer modified during enrichment.
- **Bug Fix**: **Better Outline — JS Function Children Limited to Comments Only** — LS symbol children (methods, inner variables) are no longer pushed into JS function items. Only comments detected in step 5 appear as children.

## [0.0.16]

- **New Feature**: **Install JetBrainsMono Nerd Font** — new command **"The Toy Box: Install JetBrainsMono Nerd Font"** downloads the latest release from the official Nerd Fonts GitHub repository, installs fonts to the per-user fonts folder (no admin rights required), and optionally updates `editor.fontFamily`, `editor.fontLigatures`, and `terminal.integrated.fontFamily` with your confirmation. Works on Windows, macOS, and Linux.
- **Bug Fix**: **Auto Rename Tag — `maxLinesForTagRename` setting now enforced** — the performance guard was declared in `package.json` but never read at runtime, so large files were always processed. The setting is now checked before each rename pass.
- **Bug Fix**: **Auto Rename Tag — void elements `Set` no longer rebuilt on every keystroke** — `voidElements` was reconstructed from config inside the hot rename handler. It is now cached at activation and rebuilt only when the `theToyBox.autoRenameTag.voidElements` setting changes.
- **Bug Fix**: **Better Outline — panel toggle no longer leaks event listeners** — `onDidChangeActiveTextEditor`, `onDidChangeTextDocument`, and selection listeners created in `resolveWebviewView` were accumulated each time the panel was closed and reopened. Each view instance now tracks its own disposables and cleans them up via `onDidDispose`.
- **Bug Fix**: **Better Outline — `showBackground` variable shadowing fixed** — the `showBackground` variable declared in the outer decorator scope was shadowed by a re-declaration inside the markdown heading block, causing heading background settings to be ignored.
- **Bug Fix**: **Markdown Preview — inline-content regex corrected** — the tag-matching regex `/^<[h|p|d]/` was a character class that incorrectly matched `|` and `d` instead of heading/paragraph/div tags. Corrected to `/^<(?:h[1-6]|p|pre|div)/`.
- **Bug Fix**: **Markdown Preview — `>[!NOTE]` without a space now recognized** — the alert parser required a space after `>` (e.g. `> [!NOTE]`). Both formats (`> [!NOTE]` and `>[!NOTE]`) are now accepted.
- **Bug Fix**: **Markdown Preview — end-of-file alert with no body no longer silently dropped** — an alert block at the very end of a file with no body lines was discarded. The flush now runs unconditionally when an alert is open.
- **Bug Fix**: **Markdown Preview — `theToyBox.markdownPreview.enabled` setting now applies immediately** — changing the setting previously required a window reload. The config change watcher now calls `markdown.api.reloadPlugins` so the built-in preview updates in real time.
- **Enhancement**: **Custom Comments — file extension detection hardened** — switched from a fragile `.split(".").pop()` pattern to `path.extname()`, which correctly handles dotfiles and multi-segment filenames.
- **Enhancement**: **Custom Comments & Better Outline — O(n²) quote scanner replaced** — the SQL/PHP string-boundary scanner used repeated `substring` splits. Both modules now use an O(n) single-pass flag approach (`inSingle`/`inDouble` booleans) for consistent performance on long lines.

## [0.0.15]

- **Bug Fix**: **TypeScript timeout types resolved** — added `"types": ["node"]` to `tsconfig.json` so that `@types/node` is properly referenced, resolving `Cannot find namespace 'NodeJS'` and `Cannot find name 'setTimeout'` compile errors in the Better Outline provider.

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
