# The Toy Box

![Version](https://badgen.net/vs-marketplace/v/ThomasDromgoole.theToyBox)
![Installs](https://badgen.net/vs-marketplace/i/ThomasDromgoole.theToyBox)
![Downloads](https://badgen.net/vs-marketplace/d/ThomasDromgoole.theToyBox)
![Rating](https://badgen.net/vs-marketplace/rating/ThomasDromgoole.theToyBox)
![License](https://img.shields.io/github/license/tdromgoole/TheToyBox)

> A VS Code extension that bundles a collection of everyday developer tools — cleaner files, smarter navigation, better visuals, and safer Git workflows.

---

# Why The Toy Box?

Most productivity extensions solve one small problem. **The Toy Box solves the structural workflow problem.**

- **Keep files clean** automatically.
- **See structure clearly** across Web, SQL, and PHP languages.
- **Navigate faster** with a smarter sidebar.
- **Format on the fly** with built-in JSON and alignment tools.
- **Stay fast** — optimized for large enterprise files.

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

- **✔ SQL Inside PHP & JS/TS Strings**: SQL keywords, data types, functions, and variables are colored inside string literals — making inline queries much easier to read at a glance.
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

# Extension Settings

All settings are unified under the `theToyBox` namespace.

### Print

| Setting                   | Default | Description                                                                      |
| :------------------------ | :-----: | :------------------------------------------------------------------------------- |
| `theToyBox.print.enabled` | `true`  | Enable/Disable the Print File feature (hides the option from all context menus). |

### Blocked Changes

| Setting                                   | Default | Description                                                                            |
| :---------------------------------------- | :-----: | :------------------------------------------------------------------------------------- |
| `theToyBox.blockedChanges.enabled`        | `true`  | Enable/Disable the Blocked Changes feature (panel, block button, and pre-commit hook). |
| `theToyBox.blockedChanges.addToGitignore` | `false` | Automatically add `.toybox-blocked.txt` to the repository's `.gitignore` file.         |

### Outline

| Setting                              | Default | Description                                                                       |
| :----------------------------------- | :-----: | :-------------------------------------------------------------------------------- |
| `theToyBox.showRegionsInOutline`     | `true`  | Enable/Disable the Better Outline panel.                                          |
| `theToyBox.outline.highlightOnClick` | `true`  | Briefly highlight the navigated line in the editor when clicking an outline item. |

### Word Frequency

| Setting                           | Default | Description                                      |
| :-------------------------------- | :-----: | :----------------------------------------------- |
| `theToyBox.wordFrequency.enabled` | `true`  | Enable/Disable the Word Frequency sidebar panel. |

### Cleanup

| Setting                            |          Default           | Description                                  |
| :--------------------------------- | :------------------------: | :------------------------------------------- |
| `theToyBox.cleanOnSave`            |           `true`           | Run cleanup automatically on save.           |
| `theToyBox.trimTrailingWhitespace` |           `true`           | Trim trailing whitespace from lines.         |
| `theToyBox.ignoreTrimWhitespace`   |         `[".md"]`          | File extensions to skip whitespace trimming. |
| `theToyBox.convertSpacesToTabs`    |           `true`           | Convert leading spaces to tabs.              |
| `theToyBox.ignoreTabConversion`    | `[".yaml",".yml",".json"]` | File extensions to skip tab conversion.      |

### Indent Rainbow

| Setting                          | Default | Description                                                                            |
| :------------------------------- | :-----: | :------------------------------------------------------------------------------------- |
| `theToyBox.indentRainbow`        | `true`  | Enable/Disable rainbow indent guides.                                                  |
| `theToyBox.indentRainbowOpacity` |  `10`   | Opacity of indent colors as a percentage (1–100).                                      |
| `theToyBox.indentRainbowColors`  |  `[]`   | Custom hex color palette (e.g. `["#FF6B6B","#FFD93D"]`). Empty = use built-in pastels. |

### Rename Matching Tags

| Setting                                        |      Default       | Description                                                |
| :--------------------------------------------- | :----------------: | :--------------------------------------------------------- |
| `theToyBox.autoRenameMatchingTags`             |       `true`       | Enable/Disable auto tag renaming.                          |
| `theToyBox.performance.maxLinesForTagRename`   |       `5000`       | Maximum file length (lines) for tag renaming to be active. |
| `theToyBox.autoRenameTag.activationOnLanguage` | `["html","xml",…]` | Language IDs where auto tag renaming is active.            |
| `theToyBox.autoRenameTag.voidElements`         |  `["br","img",…]`  | Self-closing tags excluded from renaming.                  |

### Markdown Preview

| Setting                             | Default | Description                                                           |
| :---------------------------------- | :-----: | :-------------------------------------------------------------------- |
| `theToyBox.markdownPreview.enabled` | `true`  | Enable/Disable Markdown alert rendering (built-in preview & webview). |

### Markdown Headings

| Setting                                        |     Default      | Description                                            |
| :--------------------------------------------- | :--------------: | :----------------------------------------------------- |
| `theToyBox.markdownHeadings.enabled`           |      `true`      | Enable/Disable heading highlighting in Markdown files. |
| `theToyBox.markdownHeadings.showBackground`    |      `true`      | Toggle background color on heading highlights.         |
| `theToyBox.markdownHeadings.fullLineHighlight` |      `true`      | Highlight the full line or just the heading text.      |
| `theToyBox.markdownHeadings.colors`            | _(see defaults)_ | Map each heading level (h1–h6) to a hex color.         |

### Syntax Highlighting

| Setting                                | Default | Description                                                                   |
| :------------------------------------- | :-----: | :---------------------------------------------------------------------------- |
| `theToyBox.syntaxHighlighting.enabled` | `true`  | Master switch — enable/disable decoration-based syntax highlighting.          |
| `theToyBox.syntaxHighlighting.phpSql`  | `true`  | Enable/Disable T-SQL highlighting inside PHP double-quoted strings.           |
| `theToyBox.syntaxHighlighting.jsSql`   | `true`  | Enable/Disable T-SQL highlighting inside JS/TS strings and template literals. |
| `theToyBox.syntaxHighlighting.kdl`     | `true`  | Enable/Disable highlighting for KDL Document Language (`.kdl`) files.         |
| `theToyBox.syntaxHighlighting.asp`     | `true`  | Enable/Disable highlighting for Classic ASP / VBScript (`.asp`) files.        |
| `theToyBox.syntaxHighlighting.razorVb` | `true`  | Enable/Disable highlighting for ASP.NET Razor VB (`.vbhtml`) files.           |
| `theToyBox.syntaxHighlighting.nginx`   | `true`  | Enable/Disable highlighting for nginx configuration (`.conf`) files.          |

### Custom Comments

| Setting                                      |     Default      | Description                                                 |
| :------------------------------------------- | :--------------: | :---------------------------------------------------------- |
| `theToyBox.customComments.enabled`           |      `true`      | Enable/Disable custom comment highlighting.                 |
| `theToyBox.customComments.showBackground`    |      `true`      | Show a background highlight behind comment lines.           |
| `theToyBox.customComments.fullLineHighlight` |      `true`      | Highlight the full line or just the comment text.           |
| `theToyBox.customComments.colors`            | _(see defaults)_ | Map trigger characters to hex colors.                       |
| `theToyBox.customComments.labels`            | _(see defaults)_ | Map trigger characters to label words shown in the outline. |
| `theToyBox.customComments.excludedFileTypes` |    `[".md"]`     | File extensions to skip custom comment highlighting.        |

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
