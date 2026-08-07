# The Toy Box

![Version](https://badgen.net/vs-marketplace/v/ThomasDromgoole.theToyBox)
![Installs](https://badgen.net/vs-marketplace/i/ThomasDromgoole.theToyBox)
![Downloads](https://badgen.net/vs-marketplace/d/ThomasDromgoole.theToyBox)
![Rating](https://badgen.net/vs-marketplace/rating/ThomasDromgoole.theToyBox)
![License](https://img.shields.io/github/license/tdromgoole/TheToyBox)

> A VS Code extension that bundles a collection of everyday developer tools — cleaner files, smarter navigation, better visuals, safer Git workflows, a built-in quick notes system, and direct PDF export — all in one package.

Most productivity extensions solve one problem. **The Toy Box solves several at once**, with every feature independently toggleable so you only use what you want.

---

## What's Inside

| Category                 | Features                                                                          |
| :----------------------- | :-------------------------------------------------------------------------------- |
| **Code Navigation**      | Better Outline Panel, Bookmarks, Word Frequency, Session Restore                  |
| **Visual Aids**          | Syntax Highlighting, Hover Docs, Custom Comments, Indent Rainbow, Markdown Alerts |
| **Code Quality**         | Auto-Cleanup on Save, Smart Alignment, JSON Formatter, Auto Rename Tags           |
| **Notes & Productivity** | Quick Notes, Scratch Pad, Tagged Comments                                         |
| **Git & Safety**         | Blocked Changes                                                                   |
| **Print & Export**       | Save as PDF (Markdown with Mermaid diagrams, HTML, and source code)               |
| **Extras**               | Install JetBrainsMono Nerd Font                                                   |

---

## Code Navigation

### Better Outline Panel

A dedicated sidebar that gives you a clear, hierarchical view of your code — a smarter, more detailed version of VS Code's built-in outline.

![Better Outline Panel](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/betterOutline.png)

- **Broad Language Support** — Works with SQL, PHP, JavaScript, TypeScript, CSS/SCSS, JSON, YAML, INI, nginx, KDL, and more, each with tailored structure detection.
- **Meaningful Structure** — Surfaces what matters per language: tables and procedures in SQL, functions and classes in PHP/JS, sections and keys in config files.
- **Collapsible Regions** — `#region` / `#endregion` markers create collapsible folders that nest any symbols found inside them.
- **Comment Integration** — Important comments appear alongside your code symbols in the outline.
- **Highlight on Click** — Clicking an item jumps to that line and briefly flashes it in the editor.

### Bookmarks

Place persistent markers on important lines and jump between them without losing your place.

- **Toggle Anywhere** — Press `Ctrl+Shift+Alt+B` to bookmark the current line; press again to remove it.
- **Quick Navigation** — Jump to the next or previous bookmark with `Ctrl+Shift+Alt+N` / `Ctrl+Shift+Alt+P`.
- **Sidebar Panel** — All bookmarks across open files are listed together. Click any entry to go straight to that line.
- **Persists Across Sessions** — Bookmarks are saved to the workspace and restored automatically on next open.

### Word Frequency Panel

A sidebar panel that counts every word in the active file and ranks them by frequency.

![Word Frequency Panel](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/wordFrequency.png)

- **Ranked List** — Most-used words rise to the top, useful for spotting dominant identifiers or unexpected repetition.
- **Jump to Any Occurrence** — Expand a word to see every line it appears on; click to jump there.
- **Live Filter** — Type to narrow the list in real time. Updates automatically as you edit or switch files.

### Session Restore

Save and restore named snapshots of your open files — useful when switching between tasks or picking up work after a break.

- **Save a Session** — Captures all currently open files and the active tab.
- **Restore a Session** — Reopens a saved set of files with a single command.
- **Manage Sessions** — Rename or delete saved sessions via a quick-pick menu.
- **Per-Workspace** — Each project keeps its own session history.

---

## Visual Aids

### Syntax Highlighting

Brings proper color coding to file types that VS Code doesn't highlight by default, and adds SQL coloring inside string literals in backend code.

![SQL in Strings](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/sqlInStrings.png)

- **SQL Inside PHP & JS/TS Strings** — SQL keywords, types, functions, and variables are colored inside string literals. Only strings that actually contain a SQL statement are highlighted — CSS classes, template strings, and other non-SQL strings are left alone.
- **Classic ASP / VBScript** — Full color coding for `.asp` files, with HTML and VBScript sections each styled appropriately.
- **ASP.NET Razor VB** — Highlights `.vbhtml` files with colors matching the Visual Studio Dark theme.
- **nginx & KDL** — Colors directives, variables, and block names in `.conf` and `.kdl` files.
- **Per-Language Control** — Toggle each language independently, or turn everything off with one setting.

### Hover Documentation

Hover over keywords to see inline documentation without leaving the editor.

- **nginx** — Covers ~100 directives and ~80 built-in variables with syntax, description, and default values.
- **Classic ASP / VBScript** — Covers language keywords and the six built-in ASP objects (`Response`, `Request`, `Server`, etc.).

### Custom Comment Highlighting

Mark important comments with a special character and they stand out with a distinct color — in the editor and in the outline.

![Custom Comment Highlighting](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/customComments.png)

- **10 Trigger Symbols** — Use `!` `*` `?` `#` `@` `$` `%` `^` `&` `~` at the start of a comment to apply a color (e.g. `!` → **CRITICAL**, `?` → **QUESTION**).
- **Full-Line Highlight** — Optionally color the entire line background for instant visual scanning.
- **Fully Customizable** — Change each symbol's label and color via settings, and exclude specific file types.

### Indent Rainbow

Adds a subtle color band to each indentation level so you can instantly see how deeply nested a block is.

![Indent Rainbow](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/indentRainbow.png)

- Works with both tabs and spaces, including Python and YAML files.
- Adjustable opacity (default: a subtle 10%) and a fully custom color palette.

### GitHub-Style Markdown Alerts

Renders GitHub-style alert callouts in VS Code's built-in Markdown preview.

![GitHub-Style Markdown Alerts](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/githubStyleAlerts.png)

Supports `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` — each with a distinct color and icon. Works automatically in the standard Markdown preview, or open a dedicated dark-themed panel with **"The Toy Box: Open Markdown Preview with Alerts"**.

![markdownTask](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/markdownTask.png)

---

## Code Quality & Editing

### Auto-Cleanup on Save

Keeps files consistently tidy on every save — trailing spaces, mixed indentation, and whitespace-only lines are cleaned up automatically.

![Auto-Cleanup on Save](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/auto-CleanupOnSave.png)

- Trims trailing whitespace and converts leading spaces to tabs (skipped automatically for files configured to use spaces).
- Lines you're actively typing on are never touched during a save.
- Each cleanup rule can be disabled per file type independently.

### Smart Code Alignment

Select a group of lines and align their operators into a clean vertical column with a single command (`Ctrl+Shift+Alt+A`).

![Smart Code Alignment](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/smartCodeAlignment.png)

Aligns `=`, `:`, `=>`, `+=`, and `-=`. Auto-detects the operator from your selection — only the lines you select are changed.

### JSON Formatter

Instantly turn a compact JSON string into properly indented, readable code.

![JSON Formatter](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/jsonFormatting.png)

Select any JSON, right-click, and choose **"The Toy Box: Format JSON Selection"** (`Ctrl+Shift+Alt+J`). Validates before changing anything, and uses your editor's current indentation style.

### Auto Rename Matching Tags

Automatically keeps opening and closing HTML/XML tags in sync as you type — rename one and the other updates instantly.

- Nesting-aware, skips self-closing void elements, and automatically disables on very large files to stay responsive.
- Configurable per language and file size limit.

---

## Notes & Productivity

### Quick Notes

A lightweight note system that creates real files, reopens them automatically on startup, and gets out of your way until you need them.

- **Instant Creation** — Run **"The Toy Box: New Quick Note"** (`Ctrl+Shift+Alt+Q`) or just start typing in any untitled file — it becomes a numbered note automatically.
- **Always Waiting** — All quick notes reopen automatically every time VS Code starts.
- **Save When Ready** — Press `Ctrl+S` to save as a permanent file, or close and choose **Save as File**, **Keep for Later**, or **Delete**.
- **Configurable Storage** — Point notes at any folder via settings. Switching folders while notes are open prompts you about each one so nothing is lost.

### Scratch Pad

A persistent notes panel built into the sidebar — always one click away, automatically saved.

- Lives in the Better Outline sidebar and auto-saves everything you type to the workspace.
- Restored exactly as you left it on next launch. Each workspace has its own separate scratch pad.
- Export to a `.txt` file at any time with the Save to File button.

### Tagged Comments (Workspace Scan)

Collects every special comment from across your entire workspace into one searchable list.

- **Auto-Scans** — The workspace is scanned a few seconds after VS Code loads, with cached results shown instantly on startup.
- **Click to Navigate** — Click any item to jump directly to that file and line.
- **Filter by Tag Type** — Show only the tag types you care about; filter choices are remembered.
- **Incremental Updates** — Saving a file updates only that file's entries — no full rescan needed.

> Tag types and colors are shared with the Custom Comments settings.

---

## Git & Safety

### Blocked Changes

Keep certain files out of your commits while still editing them freely — ideal for local config overrides or work-in-progress files you never want to accidentally push.

![Blocked Changes](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/blockedChanges.png)

- **Block from the Changes Panel** — Right-click any file in Git's Changes section and choose **Block Change**. It moves to the Blocked Changes panel and disappears from Changes instantly.
- **Commit Protection** — A pre-commit hook is installed automatically. Trying to commit a blocked file rejects the commit with a clear message.
- **Branch-Switch Warning** — If a blocked file has local changes when you try to switch branches, a warning appears listing the affected files. It clears once the files are clean.
- **Unblock or Discard** — Each blocked file has an **Unblock** button and a **Discard** button (throws away changes and removes the block).
- **Persists Across Restarts** — The block list is saved to the repo root and re-applied on next open.

---

## Print & Export

### Save as PDF

Export any open file to a PDF directly from the editor — no browser, no print dialog, no extra tools required.

- **Toolbar Icon** — The **export** icon appears in the editor title bar when a Markdown or HTML file is open. Click it to go straight to the save dialog.
- **Right-Click Export** — Right-click anywhere in the editor (or on a file in the Explorer) and choose **"The Toy Box: Save as PDF"**.
- **Markdown files** are fully rendered before export — headings, bold and italic, tables, code blocks, task lists, blockquotes, GitHub-style alerts, links, and horizontal rules all appear in the PDF exactly as they do in the preview. Mermaid diagrams (` ```mermaid ` blocks) are rendered live and embedded as images.
- **HTML files** are rendered in a temporary webview so your CSS and JavaScript apply before the content is captured. SVG elements are converted to images so charts and icons appear in the PDF.
- **Source code files** are exported with line numbers and syntax-aware coloring using a print-friendly dark-on-white palette.
- Works on any OS — everything is generated inside VS Code with no external dependencies.

---

## Extras

### Install JetBrainsMono Nerd Font

Get operator ligatures (`==`, `!=`, `=>`, `->`, and more) that render as clean symbols with correct cursor placement.

![JetBrainsMono Nerd Font comparison](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/nerdFont.png)

Run **"The Toy Box: Install JetBrainsMono Nerd Font"** from the Command Palette. No admin rights required — installs to your personal fonts folder, auto-configures VS Code, and optionally sets up the integrated terminal font too.

> **Note:** Fully close and reopen VS Code after installation. A window reload is not enough.

---

## Settings

Every feature can be enabled or disabled independently. All settings live under the `theToyBox` namespace — search **"Toy Box"** in VS Code's Settings UI to see them all.

Common controls include per-feature toggles, cleanup rules and file-type exclusions, indent rainbow opacity and custom colors, custom comment symbol-to-color mappings, syntax highlighting per-language switches, Markdown heading colors, and Quick Notes storage folder.

---

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

---

## Author

**Thomas Dromgoole**

If this extension improves your workflow, consider leaving a rating ⭐

---

## License

MIT

---

# Why The Toy Box?

Most productivity extensions solve one small problem. **The Toy Box solves several at once.**

- Keep files clean automatically on save.
- See the structure of your code clearly, even in SQL, PHP, and config files.
- Navigate faster with a smarter sidebar and persistent bookmarks.
- Track important comments across your entire workspace.
- Keep notes, save your place, and protect files from accidental commits.
- Capture ideas instantly with Quick Notes — they reopen automatically every time VS Code starts.

---

# Core Features

## Better Outline Panel

A dedicated sidebar that gives you a clear, hierarchical view of your code — think of it as a smarter, more detailed version of VS Code's built-in outline.

![Better Outline Panel](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/betterOutline.png)

- **✔ Broad Language Support**: Works with SQL, PHP, JavaScript, TypeScript, CSS/SCSS/Less, JSON, YAML, INI, nginx config, KDL, and more — each with tailored structure detection.
- **✔ Meaningful Structure**: Sees the things that matter for each language — database tables, stored procedures, and views in SQL; functions and classes in PHP and JS; sections and keys in config files.
- **✔ Collapsible Regions**: `#region` / `#endregion` markers create collapsible folders in the outline, nesting any code symbols found inside them.
- **✔ Comment Integration**: Important comments appear directly in the outline alongside your code symbols, keeping context visible without opening the file.
- **✔ Highlight on Click**: Clicking any outline item jumps to that line and briefly flashes it in the editor so you always know where you landed.
- **✔ Helpful Empty State**: When a file type isn't supported, the panel shows a friendly message rather than a blank panel.
- **✔ Works Offline**: All icons are bundled locally — no internet connection needed.

---

## Syntax Highlighting

Brings proper color coding to file types that VS Code doesn't highlight by default, and adds SQL coloring inside string literals in your backend code.

![SQL in Strings](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/sqlInStrings.png)

- **✔ SQL Inside PHP & JS/TS Strings**: SQL keywords, data types, functions, and variables are colored inside string literals — making inline queries much easier to read at a glance. Only strings that contain an actual SQL statement are highlighted, so CSS class names, template strings, and other non-SQL strings are left untouched.
- **✔ Classic ASP / VBScript**: Full color coding for `.asp` files — HTML sections and VBScript code blocks are each highlighted appropriately.
- **✔ ASP.NET Razor VB**: Highlights `.vbhtml` files with colors that match the Visual Studio Dark theme.
- **✔ nginx Configuration**: Colors directives, block names, variables, and values in `.conf` files.
- **✔ KDL Document Language**: Full color coding for `.kdl` files.
- **✔ Per-Language Control**: Each language can be toggled independently, or you can switch everything off with a single setting.

---

## Hover Documentation

Hover over keywords in supported file types to see inline documentation — no need to leave the editor or open a docs tab.

- **✔ nginx**: Hover over any directive or built-in variable to see what it does, its syntax, and its default value. Covers ~100 directives and ~80 variables.
- **✔ Classic ASP / VBScript**: Hover over keywords or the six built-in ASP objects (`Response`, `Request`, `Server`, etc.) to see their usage and available methods.
- **✔ Flicker-Free**: The tooltip only appears after a brief pause so it doesn't pop up while you're navigating through code.

---

## Word Frequency Panel

A sidebar panel that counts every word in the active file and ranks them by how often they appear.

![Word Frequency Panel](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/wordFrequency.png)

- **✔ Ranked List**: The most-used words rise to the top — useful for spotting dominant identifiers or unexpected repetition.
- **✔ Jump to Any Occurrence**: Expand any word to see every line it appears on. Click a line number to jump straight there.
- **✔ Live Filter**: Type in the search box to narrow the list in real time.
- **✔ Auto-Refresh**: Updates automatically as you edit or switch files.

---

## Custom Comment Highlighting

Mark important comments with a special character and they'll stand out with a distinct color — both in the editor and in the outline.

![Custom Comment Highlighting](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/customComments.png)

- **✔ 10 Trigger Symbols**: Use `!` `*` `?` `#` `@` `$` `%` `^` `&` `~` at the start of a comment to apply a color (e.g. `!` → **CRITICAL**, `?` → **QUESTION**).
- **✔ Full-Line Highlight**: Optionally color the entire line background for instant visual scanning.
- **✔ Custom Labels & Colors**: Change what each symbol means and what color it uses via settings.
- **✔ Exclude File Types**: Skip highlighting in specific file types (e.g. `.md`) where you don't want it.

---

## Indent Rainbow

Adds a subtle color band to each level of indentation so you can instantly see how deeply nested a block of code is.

![Indent Rainbow](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/indentRainbow.png)

- **✔ Works for Tabs and Spaces**: Handles both indentation styles, including Python and YAML files that use spaces.
- **✔ Adjustable Intensity**: Dial the opacity up or down to suit your preference (default is a subtle 10%).
- **✔ Custom Colors**: Replace the built-in pastel palette with your own hex color list, or leave it empty to keep the defaults.

---

## GitHub-Style Markdown Alerts

Renders GitHub-style alert callouts in VS Code's built-in Markdown preview with color-coded styling and icons.

![GitHub-Style Markdown Alerts](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/githubStyleAlerts.png)

- **✔ Five Alert Types**: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` — each with a distinct color and icon.
- **✔ Custom Headings**: Add your own title after the alert type (e.g. `[!NOTE][My Heading]`) to replace the default.
- **✔ Works in the Built-In Preview**: No separate command needed — just open the standard Markdown preview.
- **✔ Standalone Preview**: Also available as **"The Toy Box: Open Markdown Preview with Alerts"** for a dedicated dark-themed panel.

![markdownTask](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/markdownTask.png)

---

## JSON Formatter

Instantly turn a compact, single-line JSON string into properly indented, readable code.

![JSON Formatter](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/jsonFormatting.png)

- **✔ Right-Click to Format**: Select any JSON string, right-click, and choose **"The Toy Box: Format JSON Selection"**.
- **✔ Safe**: Validates the JSON before making any changes so you never lose data.
- **✔ Respects Your Settings**: Uses your editor's current indentation style automatically.

---

## Smart Code Alignment

Select a group of lines and align their operators into a clean vertical column with a single command.

![Smart Code Alignment](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/smartCodeAlignment.png)

- **✔ Multiple Operators**: Aligns `=`, `:`, `=>`, `+=`, and `-=`.
- **✔ Auto-Detects the Operator**: Figures out which operator to align from your selection — no manual picking needed in most cases.
- **✔ Selection-Only**: Only the lines you select are changed. Nothing else in the file is touched.

---

## Blocked Changes

Keep certain files out of your commits while still being able to edit them freely — useful for local config overrides or work-in-progress files you never want to accidentally push.

![Blocked Changes](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/blockedChanges.png)

- **✔ Block from the Changes Panel**: Right-click any file in Git's **Changes** section and choose **Block Change**. The file moves to the **Blocked Changes** panel and disappears from Changes instantly.
- **✔ Commit Protection**: A pre-commit hook is automatically installed — if you try to commit a blocked file, the commit is rejected with a clear message telling you which files to unblock first.
- **✔ Branch-Switch Warning**: If a blocked file has local changes, you'll see a clear warning in the panel and as a notification — including which files are affected and a reminder to stash or discard them before switching branches. The warning disappears automatically once the files are clean.
- **✔ Unblock or Discard**: Each blocked file has an **Unblock** button to restore normal tracking, and a **Discard** button to throw away local changes and remove the block in one step.
- **✔ Persists Across Restarts**: The block list is saved to the repo root and re-applied automatically every time you open the workspace.
- **✔ Team-Safe**: Unblocking and the optional `.gitignore` entry both ask for confirmation, so one teammate's settings can't silently affect another's workflow.
- **✔ Works with New Files Too**: Blocking a brand-new file that hasn't been committed yet hides it from the Changes panel just like any other file — no extra steps needed.
- **✔ Works on Managed Machines**: Resolves git through VS Code's own settings, so it works correctly even on computers where git isn't on the system PATH.

---

## Auto-Cleanup on Save

Keeps files consistently tidy every time you save — trailing spaces, mixed indentation, and whitespace-only lines are cleaned up automatically.

![Auto-Cleanup on Save](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/auto-CleanupOnSave.png)

- **✔ Trim Trailing Whitespace**: Removes invisible trailing spaces and tabs from every line.
- **✔ Convert Spaces to Tabs**: Converts leading spaces to tabs where appropriate. Automatically skipped for files configured to use spaces.
- **✔ Safe While Editing**: Lines you're actively typing on or have selected are never touched during a save.
- **✔ Per-File-Type Overrides**: Exclude specific file types (e.g. `.yaml`, `.json`) from any cleanup rule independently.

---

## Auto Rename Matching Tags

Automatically keeps opening and closing HTML/XML tags in sync as you type — rename one and the other updates instantly.

- **✔ Nesting-Aware**: Correctly finds the matching tag even in deeply nested structures.
- **✔ Skips Self-Closing Tags**: Void elements like `<br>`, `<img>`, and `<input>` are ignored automatically.
- **✔ Performance Guard**: Automatically disables on very large files to keep the editor responsive.
- **✔ Configurable**: Choose which languages it activates for and set a file size limit.

---

## Install JetBrainsMono Nerd Font

Get operator ligatures (`==`, `!=`, `=>`, `->`, and more) that render as clean symbols — with correct cursor placement.

![JetBrainsMono Nerd Font comparison](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/nerdFont.png)

Run **"The Toy Box: Install JetBrainsMono Nerd Font"** from the Command Palette to download, install, and configure the font automatically.

- **✔ No Admin Rights Required**: Installs to your personal fonts folder.
- **✔ Auto-Configures VS Code**: Sets the font family and enables ligatures with your confirmation.
- **✔ Terminal Support**: Optionally configures the integrated terminal font too — great for Powerline or Oh-My-Posh prompts.
- **✔ Cross-Platform**: Works on Windows, macOS, and Linux.

> **Note:** Fully close and reopen VS Code after installation for the font to become available. A window reload is not enough.

---

## Bookmarks

Place persistent markers on important lines and jump between them without losing your place.

- **✔ Toggle Anywhere**: Press `Ctrl+Shift+Alt+B` (or use the Command Palette) to bookmark the current line. Press it again to remove the bookmark.
- **✔ Quick Navigation**: Jump to the next or previous bookmark with keyboard shortcuts.
- **✔ Sidebar Panel**: All bookmarks across all open files are listed in the sidebar. Click any entry to go straight to that line.
- **✔ Always Visible**: Bookmarks are highlighted in the editor's overview ruler so you can spot them at a glance even in long files.
- **✔ Persists Across Sessions**: Bookmarks are saved to the workspace and restored automatically the next time you open it.

---

## Tagged Comments (Workspace Scan)

Collects every special comment from across your entire workspace into one searchable list — so nothing important gets buried.

- **✔ Scans Automatically**: The workspace is scanned a few seconds after VS Code loads. No manual step needed.
- **✔ Results Persist**: Results from the last scan are shown immediately on startup, even before the next scan runs.
- **✔ Click to Navigate**: Click any item to jump directly to that file and line.
- **✔ Filter by Tag Type**: Use the filter buttons at the top of the panel to show only the tag types you care about (e.g. only CRITICAL and TODO). Your filter choices are remembered.
- **✔ Incremental Updates**: When you save a file, that file's entries are updated automatically — no full rescan needed.

> Tag types and colors are controlled by the Custom Comments settings (`theToyBox.customComments.colors` and `.labels`).

---

## Scratch Pad

A persistent notes panel built into the sidebar — always one click away, automatically saved.

- **✔ Always There**: Scratch Pad lives in the Better Outline sidebar. Open it whenever you need a quick note.
- **✔ Auto-Saves**: Everything you type is saved instantly to the workspace. Notes are restored exactly as you left them the next time you open VS Code.
- **✔ Save to File**: Export your notes to a `.txt` file at any time with the Save to File button.
- **✔ Per-Workspace**: Each workspace has its own scratch pad, so notes for different projects stay separate.

---

## Quick Notes

A lightweight note system that creates real files, reopens them automatically on startup, and gets out of your way until you need them.

- **✔ Instant Creation**: Run **"The Toy Box: New Quick Note"** (`Ctrl+Shift+Alt+Q`) or just start typing in any untitled file — it becomes a numbered quick note automatically after a brief pause.
- **✔ Always Waiting**: All your quick notes reopen automatically every time VS Code starts. Nothing to remember, nothing to hunt for.
- **✔ Save When Ready**: Press `Ctrl+S` on a note to save it as a permanent file wherever you like. Or close a note and choose from **Save as File**, **Keep for Later**, or **Delete**.
- **✔ Smart Numbering**: Note slots are always reused from the lowest available number — if you delete notes 1 and 2, the next new note is note 1 again.
- **✔ Language-Aware**: Switch a note’s language mode to JavaScript, SQL, or anything else and it remembers that choice the next time the note opens.
- **✔ Configurable Storage**: Point notes at any folder on your machine via settings — including `~` paths on Linux and macOS. Use **"The Toy Box: Reset Quick Notes Folder to Default"** to go back to the built-in location at any time.
- **✔ Smooth Folder Changes**: Switching the storage folder while notes are open prompts you about each note — save it as a permanent file, keep it in the old folder, or delete it. Nothing is lost silently.
- **✔ Cross-Platform**: Works reliably on Windows, macOS, and Linux — including all common Linux distribution types.

---

## Session Restore

Save and restore named snapshots of your open files — useful when you switch between tasks or pick up work after a break.

- **✔ Save a Session**: Run **"The Toy Box: Save Session"** to capture all currently open files and the active tab.
- **✔ Restore a Session**: Run **"The Toy Box: Restore Session"** to reopen a saved set of files.
- **✔ Manage Sessions**: Run **"The Toy Box: Manage Sessions"** to rename or delete saved sessions.
- **✔ Per-Workspace**: Sessions are stored per workspace, so each project keeps its own history.

---

# Extension Settings

Every feature in The Toy Box can be enabled or disabled independently, and most have additional options to tailor their behaviour to your workflow. All settings live under the `theToyBox` namespace in VS Code's Settings UI — just search for **"Toy Box"** to see them all.

Common things you can control:

- **Turn individual features on or off** — almost every feature has its own enable/disable toggle.
- **Auto-cleanup** — choose which rules apply and which file types to skip.
- **Indent rainbow** — set the opacity and supply your own color palette.
- **Custom comments** — map symbols to colors and labels, choose which file types to skip.
- **Syntax highlighting** — toggle each supported language independently with a master on/off switch.
- **Markdown headings** — pick a color for each heading level.
- **Outline** — control click-to-highlight behaviour and region visibility.
- **Quick Notes** — set a custom storage folder or leave it empty for the built-in default.
- **Blocked Changes** — optionally add the block list to `.gitignore` automatically.
- **Tag rename, word frequency, bookmarks, session restore, scratch pad, print** — each has its own enable/disable toggle and any relevant options.

---

# Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

---

# Author

**Thomas Dromgoole**

If this extension improves your workflow, consider leaving a rating ⭐

---

# 🪪 License

MIT
