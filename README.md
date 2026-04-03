# The Toy Box

![Version](https://img.shields.io/visual-studio-marketplace/v/ThomasDromgoole.theToyBox)
![Downloads](https://img.shields.io/visual-studio-marketplace/d/ThomasDromgoole.theToyBox)
![Installs](https://img.shields.io/visual-studio-marketplace/i/ThomasDromgoole.theToyBox)
![License](https://img.shields.io/github/license/tdromgoole/TheToyBox)

> A high-performance VS Code extension for structural organization, whitespace cleanup, visual clarity, and synchronized HTML/XML tag renaming.

Built for developers who care about **clean structure**, **performance**, and **editor precision**.

---

# 🚀 Why The Toy Box?

Most productivity extensions solve one small problem. **The Toy Box solves the structural workflow problem.**

- **Keep files clean** automatically.
- **See structure clearly** across Web, SQL, and PHP languages.
- **Navigate faster** with a smarter sidebar.
- **Format on the fly** with built-in JSON and alignment tools.
- **Stay fast** — optimized for large enterprise files.

---

# ✨ Core Features

## 🧭 Better Outline Panel (Advanced Structural View)

A dedicated sidebar that provides a deep, hierarchical view of your code with specialized language support and Material Symbols icons.

![Better Outline Panel](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/betterOutline.png)

- **✔ SQL & PostgreSQL Entity Support**: Automatically identifies and displays **Tables**, **Stored Procedures**, **Functions**, and **Views** with unique icons.
- **✔ PHP Function Support**: Detects `public`, `private`, `protected`, `static`, and standalone functions and displays them with a dedicated Function icon.
- **✔ JavaScript / TypeScript Support**: Detects named functions, arrow functions, and ES6 classes. jQuery `.on()` and `.delegate()` handlers are detected and labelled as `selector.Event` or `selector.Event.Delegate` with class/ID icons. Comments inside functions are nested as collapsible children.
- **✔ CSS / SCSS / Less Support**: Detects element selectors, `.class` selectors, `#id` selectors, custom properties (`--var`), `@media` queries, `@keyframes` blocks, and generic at-rules — each with a distinct icon.
- **✔ Structural Nesting**: Comments nest under their parent function. Functions with nested comments are collapsible — clicking also jumps to the line.
- **✔ #region Support**: Full support for collapsible `#region` folders — works across all supported languages including SQL, PHP, JavaScript, CSS, and SCSS.
- **✔ SQL & PHP region nesting**: Tables, views, procedures, functions, and PHP functions detected inside a `#region` block are correctly nested under it as collapsible children.
- **✔ Smart Comment Integration**: Displays comments directly in the outline. Standard comments are cleaned of code prefixes (e.g., `//` is removed) for a professional look.
- **✔ Highlight on Click**: Briefly flashes the target line using the theme's find-match highlight color when you click an outline item — making it easy to spot where the cursor landed. Toggle with `theToyBox.outline.highlightOnClick`.
- **✔ Empty State Guidance**: When a file type is unsupported or no language extension is installed, the panel shows a clear "No symbols found" message with a hint rather than a blank panel.
- **✔ Material Symbols Icons**: All outline icons use Google's Material Symbols font, bundled locally — no internet connection required.

---

## 📊 Word Frequency Panel

A sidebar panel that tallies every unique word and token in the active file and displays them ranked by frequency.

![Word Frequency Panel](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/wordFrequency.png)

- **✔ Frequency Ranking**: All tokens sorted highest-to-lowest so the most-used identifiers surface immediately.
- **✔ Expandable Occurrences**: Click any row to expand it and see every line number where that word appears as clickable chips — each chip jumps the cursor to that exact line.
- **✔ Real-Time Filter**: A search box narrows the list as you type. Expanding a row is preserved through filtering.
- **✔ Auto-Refresh**: The panel updates automatically when you switch files or edit the document.
- **✔ Enable/Disable**: Toggle the panel on or off via `theToyBox.wordFrequency.enabled`.

---

## 🎨 Custom Comment Highlighting

Categorize important notes visually in both the editor and the outline with color-coded comment markers.

![Custom Comment Highlighting](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/customComments.png)

- **✔ 10 Trigger Symbols**: `!` `*` `?` `#` `@` `$` `%` `^` `&` `~` — each maps to a distinct color and label (e.g. `!` → **CRITICAL**, `?` → **QUESTION**).
- **✔ Full-Line Background Highlight**: Optional background color wash across the entire line for instant visual scanning.
- **✔ Custom Label Mapping**: Map symbols to specific words shown in the outline panel.
- **✔ SQL-Safe & PHP-Safe Scanning**: Intelligent detection that ignores SQL strings, temp tables, and PHP variable references (e.g., `$varName`) while still highlighting actual comments.
- **✔ Excluded File Types**: Specify file extensions (e.g., `.md`) to skip comment highlighting entirely.
- **✔ Configurable Colors**: Each symbol's color is fully customizable via settings.

---

## 🌈 Indent Rainbow

Adds a subtle pastel background highlight to each indentation level so nesting depth is instantly visible at a glance.

![Indent Rainbow](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/indentRainbow.png)

- **✔ Alternating Warm/Cool Palette**: 12 curated pastel tones alternate between warm and cool so adjacent levels are never visually similar.
- **✔ Adjustable Opacity**: Set the intensity from 1–100% to match your preference (default: 10%).
- **✔ Tab & Space Support**: Highlights work for both tab-indented and space-indented files (Python, YAML, etc.). Space levels are grouped by the editor's tab size setting.
- **✔ Custom Color Palette**: Override the built-in colors with your own hex values via `theToyBox.indentRainbowColors`. Leave the setting empty to revert to the default pastel palette.
- **✔ Enable/Disable**: Toggle on or off without restarting VS Code.

---

## 📋 GitHub-Style Markdown Alerts

The built-in VS Code Markdown preview now renders GitHub-style alert callouts with color-coded styling and icons.

![GitHub-Style Markdown Alerts](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/githubStyleAlerts.png)

- **✔ Built-in Preview Integration**: Works directly in the standard Markdown preview (`Ctrl+Shift+V`) — no separate command needed.
- **✔ Five Alert Types**: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]`, each with a distinct color and Material Symbols icon.
- **✔ Custom Heading**: Add a custom heading after the alert type — e.g. `[!NOTE][My Heading]` — to replace the default title.
- **✔ Flexible Syntax**: Works with or without a space after `>` — both `> [!NOTE]` and `>[!NOTE]` are recognized.
- **✔ Offline Font**: The Material Symbols icon font is bundled with the extension — no network request needed.
- **✔ Custom Webview Preview**: Also available as **"The Toy Box: Open Markdown Preview with Alerts"** for a standalone dark-themed preview panel.
- **✔ Enable/Disable**: Toggle the entire feature on or off via `theToyBox.markdownPreview.enabled`.

![markdownTask](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/markdownTask.png)

---

## 📦 JSON Formatter

Instantly turn messy, single-line JSON strings into perfectly indented, readable code.

![JSON Formatter](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/jsonFormatting.png)

- **✔ Smart Parsing**: Validates JSON structure before formatting to prevent data loss.
- **✔ Tab-Aware**: Automatically uses your editor's current tab/space settings.
- **✔ Context Menu**: Right-click any JSON selection and choose **"The Toy Box: Format JSON Selection"**.

---

## 📏 Smart Code Alignment

Align operators across multiple lines perfectly using the least number of tabs possible.

![Smart Code Alignment](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/smartCodeAlignment.png)

- **✔ Multi-Operator Support**: Aligns `=` (assignment), `:` (object keys), `=>` (fat arrow / PHP arrays), `+=`, and `-=`.
- **✔ Auto-Detection**: The operator is detected automatically from the selection — more specific operators take priority (e.g. `=>` before `=`). A picker only appears when detection is ambiguous.
- **✔ Indentation Aware**: Correctly calculates visual width so operators align even across lines at different indentation levels.
- **✔ Tab-Based**: Uses your editor's specific tab size to calculate the perfect visual gutter.
- **✔ Selection-Scoped**: Only aligns the lines you select — the rest of the file is untouched.

---

## 🧹 Auto-Cleanup on Save

Keeps files consistently formatted every time you save — no manual effort required.

![Auto-Cleanup on Save](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/auto-CleanupOnSave.png)

- **✔ Trim Trailing Whitespace**: Removes invisible trailing spaces and tabs from every line.
- **✔ Convert Spaces to Tabs**: Intelligently converts leading spaces to tabs based on detected indentation width.
- **✔ Empty Line Cleanup**: Strips lines that contain only whitespace.
- **✔ Cursor-Safe**: Lines under the active cursor are skipped during save-cleanup to prevent disruptive edits while typing.
- **✔ Per-Extension Overrides**: Exclude specific file types (e.g. `.yaml`, `.json`, `.md`) from tab conversion or whitespace trimming independently.
- **✔ Enable/Disable**: Toggle `theToyBox.cleanOnSave` to run cleanup manually instead.

---

## 🏷️ Auto Rename Matching Tags

Automatically keeps opening and closing HTML/XML tags in sync as you type.

- **✔ Structural Awareness**: Uses a structural partner-finding algorithm to correctly match nested tags — doesn't just find the nearest tag by name.
- **✔ Void Element Aware**: Self-closing tags (`<br>`, `<img>`, `<input>`, etc.) are automatically excluded.
- **✔ Language Selective**: Active only for configured languages (HTML, XML, PHP, JavaScript, JSX, TSX by default).
- **✔ Performance Guard**: Automatically disables on files over a configurable line limit (default: 5,000 lines) to protect performance on large files.
- **✔ Debounced**: Waits 150ms after the last keystroke before applying to avoid fighting with the undo stack while typing rapidly.

---

## 🔤 Install JetBrainsMono Nerd Font

Get native operator ligatures (`==` → `⩵`, `!=` → `≠`, `=>` → `⇒`, `->` → `→`, and more) with correct cursor placement — no extension hacks needed.

![JetBrainsMono Nerd Font comparison](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/nerdFont.png)

Run the command **"The Toy Box: Install JetBrainsMono Nerd Font"** from the Command Palette to:

- **✔ Download** the latest JetBrainsMono Nerd Font release directly from the official [Nerd Fonts GitHub](https://github.com/ryanoasis/nerd-fonts) repository.
- **✔ Install** to your per-user fonts folder — no admin/sudo rights required.
- **✔ Configure** `editor.fontFamily` and `editor.fontLigatures` automatically (with your confirmation).
- **✔ Terminal Support**: Optionally sets `terminal.integrated.fontFamily` to the Mono variant (single-width Nerd glyphs — ideal for Powerline/Oh-My-Posh prompts).
- **✔ Cross-Platform**: Works on Windows, macOS, and Linux with platform-appropriate font installation paths.

> **Note:** After installation, fully close and reopen VS Code (File → Exit, then reopen) for the OS font system to make the new font available. A window reload is not sufficient.

---

# ⚙️ Extension Settings

All settings are unified under the `theToyBox` namespace.

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

# 📌 Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

---

# 👤 Author

**Thomas Dromgoole**

If this extension improves your workflow, consider leaving a rating ⭐

---

# 🪪 License

MIT
