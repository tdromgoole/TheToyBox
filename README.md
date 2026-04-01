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

# ✨ Core Features

## 🧭 Better Outline Panel (Advanced Structural View)

A dedicated sidebar that provides a deep, hierarchical view of your code with specialized language support and Material Symbols icons.

- **✔ SQL & PostgreSQL Entity Support**: Automatically identifies and displays **Tables**, **Stored Procedures**, **Functions**, and **Views** with unique icons.
- **✔ PHP Function Support**: Detects `public`, `private`, `protected`, `static`, and standalone functions and displays them with a dedicated Function icon.
- **✔ Structural Nesting**: Comments, variables, and inner functions nest under their parent class/function.
- **✔ #region Support**: Full support for collapsible `#region` folders — works across all supported languages including SQL and PHP.
- **✔ SQL & PHP region nesting**: Tables, views, procedures, functions, and PHP functions detected inside a `#region` block are correctly nested under it as collapsible children.
- **✔ Smart Comment Integration**: Displays comments directly in the outline. Standard comments are cleaned of code prefixes (e.g., `//` is removed) for a professional look.
- **✔ Material Symbols Icons**: All outline icons use Google's Material Symbols font, bundled locally — no internet connection required.

## 📋 GitHub-Style Markdown Alerts

The built-in VS Code Markdown preview now renders GitHub-style alert callouts with color-coded styling and icons.

- **✔ Built-in Preview Integration**: Works directly in the standard Markdown preview (Ctrl+Shift+V) — no separate command needed.
- **✔ Five Alert Types**: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]`, each with a distinct color and Material Symbols icon.
- **✔ Custom Heading**: Add a custom heading after the alert type — e.g. `[!NOTE][My Heading]` — to replace the default title with your own text.
- **✔ Offline Font**: The Material Symbols icon font is bundled with the extension — no Google Fonts network request needed.
- **✔ Custom Webview Preview**: Also available as **"The Toy Box: Open Markdown Preview with Alerts"** for a standalone dark-themed preview panel.
- **✔ Enable/Disable**: Toggle the entire feature on or off via `theToyBox.markdownPreview.enabled`.

## 📦 JSON Formatter

Instantly turn messy, single-line JSON strings into perfectly indented, readable code.

- **✔ Smart Parsing**: Validates JSON structure before formatting to prevent data loss.
- **✔ Tab-Aware**: Automatically uses your editor's current tab/space settings.
- **✔ Context Menu**: Right-click any JSON selection and choose **"The Toy Box: Format JSON Selection"**.

## 📏 Smart Code Alignment

Align assignment operators (`=`) across multiple lines perfectly using the least amount of tabs possible.

- **✔ Indentation Aware**: Correctly calculates visual width so that `=` symbols align even when lines are at different indentation levels.
- **✔ Tab-Based**: Uses your editor's specific tab size to calculate the perfect visual gutter.

## � Indent Rainbow

Adds a subtle pastel background highlight to each indentation level so nesting depth is instantly visible at a glance.

- **✔ Alternating Warm/Cool Palette**: 12 curated pastel tones (pink, sky blue, peach, lavender, rose, mint, yellow, periwinkle, blush, sage, mauve, lilac) alternate between warm and cool so adjacent levels are never visually similar.
- **✔ Subtle 10% Opacity**: The tints are intentionally low-contrast — just enough to guide the eye without distracting from the code.
- **✔ Tab-Level Aware**: Highlights are applied per tab stop so mixed-indent files still display correctly.

## �🎨 Custom Comment Highlighting

Categorize important notes visually in both the editor and the outline.

- **✔ Custom Label Mapping**: Map symbols (e.g., `!`, `?`) to specific words like **CRITICAL** or **QUESTION** in the sidebar.
- **✔ SQL-Safe & PHP-Safe Scanning**: Intelligent detection that ignores SQL strings, temp tables, and PHP variable references (e.g., `$varName`) while still highlighting actual comments.
- **✔ Excluded File Types**: Specify file extensions (e.g., `.md`) to skip comment highlighting entirely.

---

# ⚙️ Extension Settings

All settings are unified under the `theToyBox` namespace.

| Setting                                        | Description                                                               |
| :--------------------------------------------- | :------------------------------------------------------------------------ |
| `theToyBox.showRegionsInOutline`               | Enable/Disable the Better Outline panel.                                  |
| `theToyBox.cleanOnSave`                        | Run cleanup automatically on save.                                        |
| `theToyBox.indentRainbow`                      | Enable/Disable the Indent Rainbow indent guides.                          |
| `theToyBox.indentRainbowOpacity`               | Opacity of the indent rainbow background colors, as a percentage (1–100). |
| `theToyBox.markdownPreview.enabled`            | Enable/Disable Markdown Preview with Alerts (built-in & webview).         |
| `theToyBox.markdownHeadings.enabled`           | Enable/Disable heading highlighting in Markdown files.                    |
| `theToyBox.markdownHeadings.showBackground`    | Toggle background color on heading highlights.                            |
| `theToyBox.markdownHeadings.fullLineHighlight` | Highlight the full line or just the heading text.                         |
| `theToyBox.markdownHeadings.colors`            | Map each heading level (h1–h6) to a hex color.                            |
| `theToyBox.customComments.enabled`             | Enable or disable custom comment highlighting.                            |
| `theToyBox.customComments.labels`              | Map symbols (like `!`) to words (like `CRITICAL`) in the outline.         |
| `theToyBox.customComments.colors`              | Map special characters to hex colors.                                     |
| `theToyBox.customComments.excludedFileTypes`   | File extensions to skip custom comment highlighting (e.g. `.md`).         |

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
