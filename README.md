# The Toy Box

![Version](https://badgen.net/vs-marketplace/v/ThomasDromgoole.theToyBox)
![Installs](https://badgen.net/vs-marketplace/i/ThomasDromgoole.theToyBox)
![Downloads](https://badgen.net/vs-marketplace/d/ThomasDromgoole.theToyBox)
![Rating](https://badgen.net/vs-marketplace/rating/ThomasDromgoole.theToyBox)
![License](https://img.shields.io/github/license/tdromgoole/TheToyBox)

The Toy Box brings a collection of practical everyday tools into one VS Code extension. Navigate large files, keep code tidy, capture notes, improve Markdown, protect local Git changes, and export polished PDFs without assembling a long list of separate extensions.

Every major feature can be enabled or disabled, so you can keep the tools that fit your workflow.

## Highlights

| Area | What The Toy Box Adds |
| :--- | :--- |
| Navigation | Better Outline, bookmarks, word frequency, and saved sessions |
| Editing | Cleanup on save, operator alignment, JSON formatting, and matching-tag rename |
| Visuals | Extra syntax highlighting, hover help, custom comments, and indent guides |
| Markdown | GitHub-style alerts and print-ready PDF export |
| Productivity | Quick Notes and a workspace-wide tagged-comment list |
| Git | A safe place for local changes that should not be committed |
| Project Setup | Guided ESLint and PHPStan installation and setup |
| Extras | Optional JetBrainsMono Nerd Font installation |

## Better Navigation

The **Better Outline** sidebar provides a useful structural view for SQL, PHP, JavaScript, TypeScript, CSS, JSON, YAML, INI, nginx, KDL, and other supported files. It recognizes the concepts that matter in each language, supports regions, and takes you directly to the selected line.

![Better Outline Panel](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/betterOutline.png)

Bookmarks keep important lines close at hand, while Session Restore lets you save and reopen named groups of files. The Word Frequency panel helps you explore repeated terms and identifiers in the active document.

## Clearer Code

The Toy Box adds visual support where VS Code may not provide enough by default:

- Syntax highlighting for Classic ASP, Razor VB, nginx, and KDL.
- SQL highlighting inside PHP and JavaScript/TypeScript strings when they contain an actual query.
- Hover documentation for nginx and Classic ASP/VBScript.
- Configurable comment labels such as CRITICAL, QUESTION, TODO, and NOTE.
- Subtle, customizable indentation colors.

![SQL in Strings](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/sqlInStrings.png)

![Custom Comment Highlighting](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/customComments.png)

## Markdown and PDF Export

GitHub-style alerts appear directly in VS Code's built-in Markdown preview. The supported alert types are NOTE, TIP, IMPORTANT, WARNING, and CAUTION, including optional custom titles.

![GitHub-Style Markdown Alerts](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/githubStyleAlerts.png)

Use **The Toy Box: Save as PDF** or **The Toy Box: Print File** to create a polished PDF from Markdown, HTML, or source code.

Markdown export includes:

- Headings, paragraphs, links, lists, tables, images, and task-list checkboxes.
- GitHub-style alerts with print-friendly colors and icons.
- Mermaid diagrams rendered locally without an internet connection.
- Broad syntax highlighting for common programming and configuration languages, with a plain-code fallback.

HTML is rendered before export, and other file types are printed as readable source code with line numbers.

## Everyday Editing Tools

- **Auto-Cleanup on Save** removes unwanted trailing whitespace and normalizes indentation while respecting VS Code's per-file settings.
- **Smart Code Alignment** lines up operators such as `=`, `:`, and `=>` within a selection.
- **JSON Formatter** turns selected compact JSON into readable, correctly indented content.
- **Auto Rename Matching Tags** keeps paired HTML and XML tags synchronized while you type.

Cleanup follows the **Spaces** or **Tab Size** choice in VS Code's status bar. Choose **Indent Using Tabs** to convert leading spaces to tabs. Mixed indentation keeps its visual alignment, and multiline string content is preserved. Run **The Toy Box: Fix Tabs and Trim** to clean a selection or the file.

![Smart Code Alignment](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/smartCodeAlignment.png)

## Notes and Project Awareness

### Project Setup

Run **The Toy Box: Set Up ESLint** or **The Toy Box: Set Up PHPStan** from the Command Palette in a trusted workspace. Choose the project folder and options, review the proposed files and install command, then select **Apply Setup**.

- **ESLint:** Add code checks for JavaScript or TypeScript, with optional automatic fixes on save.
- **PHPStan:** Add PHP code checks, choose how strict they should be, and optionally include Laravel or Symfony support.

Existing project configurations are preserved. Installation progress appears in a terminal. JavaScript projects need Node.js and a supported package manager; PHP projects need PHP and Composer. Framework projects may need further customization.

See the official [ESLint setup guide](https://eslint.org/docs/latest/use/getting-started) and [PHPStan setup guide](https://phpstan.org/user-guide/getting-started) for further configuration.

**Quick Notes** keeps automatically saved notes that reopen with VS Code. Use **New Quick Note** to capture an idea and save it as a permanent file whenever it is ready. You can optionally turn on automatic capture of untitled files in User Settings, where you also choose your notes folder.

The Toy Box custom Markdown preview blocks remote images by default. You can allow HTTPS images in User Settings; doing so contacts the image host. VS Code's built-in preview has its own settings.

Keep feature notes close to the code they describe. Add an `@docs` reference near the top of a source file, and The Toy Box displays a book link that opens the related Markdown document:

```ts
// @docs: docs/authentication.md
```

The **Tagged Comments** panel scans the workspace for your configured comment labels and gathers them into a filterable list. Select an entry to jump directly to its file and line.

## Safer Local Git Changes

**Blocked Changes** helps keep local configuration, experiments, and work-in-progress files out of commits. Blocked files appear in their own Source Control panel and can be restored to normal tracking when you are ready.

![Blocked Changes](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/blockedChanges.png)

The feature includes commit protection and warns when local blocked changes may interfere with switching branches. As with any Git workflow tool, review the affected files before discarding changes.

## Optional Nerd Font Setup

Run **The Toy Box: Install JetBrainsMono Nerd Font** to download and configure JetBrainsMono Nerd Font for your user account. The extension asks before changing editor or terminal font settings.

![JetBrainsMono Nerd Font comparison](https://raw.githubusercontent.com/tdromgoole/TheToyBox/refs/heads/main/images/nerdFont.png)

Fully close and reopen VS Code after installation so the operating system can make the font available.

## Getting Started

1. Install The Toy Box and reload VS Code if prompted.
2. Open the Command Palette and search for **The Toy Box** to see its commands.
3. Open Settings and search for **Toy Box** to enable, disable, or customize individual features.
4. Open the Toy Box activity-bar view for outline, bookmark, tagged-comment, and word-frequency tools.

Useful default shortcuts:

| Action | Windows/Linux | macOS |
| :--- | :--- | :--- |
| New Quick Note | `Ctrl+Shift+Alt+Q` | `Cmd+Shift+Alt+Q` |
| Toggle Bookmark | `Ctrl+Shift+Alt+B` | `Cmd+Shift+Alt+B` |
| Next Bookmark | `Ctrl+Shift+Alt+N` | `Cmd+Shift+Alt+N` |
| Align Selection | `Ctrl+Shift+Alt+A` | `Cmd+Shift+Alt+A` |
| Format JSON Selection | `Ctrl+Shift+Alt+J` | `Cmd+Shift+Alt+J` |
| Markdown Preview with Alerts | `Ctrl+Shift+Alt+M` | `Cmd+Shift+Alt+M` |

## Configuration

Most features have an individual toggle under the `theToyBox` settings namespace. Additional settings control cleanup rules, outline behavior, Markdown heading colors, comment labels, indentation colors, Quick Notes storage, syntax support, and other feature-specific preferences.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

## Support

Report problems or request improvements through the project's [GitHub repository](https://github.com/tdromgoole/TheToyBox/issues).

## Author and License

Created by **Thomas Dromgoole** and released under the [MIT License](LICENSE).
