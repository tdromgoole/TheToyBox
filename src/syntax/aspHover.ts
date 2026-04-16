import * as vscode from "vscode";

// ─── VBScript keyword documentation ──────────────────────────────────────────
let _keywordDocs: Map<string, string> | undefined;
function getKeywordDocs(): Map<string, string> {
	if (!_keywordDocs) {
		_keywordDocs = new Map<string, string>([
			// ── Declarations ──
			[
				"dim",
				"Declares one or more variables.\n\n**Syntax:** `Dim varname[([subscripts])][, varname[([subscripts])]]`\n\n**Example:**\n```vbscript\nDim name, age\nDim arr(10)\n```",
			],
			[
				"redim",
				"Re-declares a dynamic array variable and reallocates its storage.\n\n**Syntax:** `ReDim [Preserve] varname(subscripts)`\n\n**Example:**\n```vbscript\nReDim Preserve arr(20)\n```",
			],
			[
				"preserve",
				"Used with `ReDim` to retain existing data in an array when it is resized.\n\n**Syntax:** `ReDim Preserve varname(subscripts)`",
			],
			[
				"const",
				"Declares a named constant that cannot be changed at runtime.\n\n**Syntax:** `Const name = expression`\n\n**Example:**\n```vbscript\nConst MAX_SIZE = 100\n```",
			],
			[
				"set",
				'Assigns an object reference to a variable, or destroys a reference by assigning `Nothing`.\n\n**Syntax:** `Set objectvar = objectexpression | Nothing`\n\n**Example:**\n```vbscript\nSet conn = Server.CreateObject("ADODB.Connection")\nSet conn = Nothing\n```',
			],
			[
				"let",
				"Assigns a value to a variable or property. The keyword is optional in VBScript.\n\n**Syntax:** `[Let] varname = expression`",
			],
			[
				"option",
				"Used with `Explicit` to require all variables to be declared before use.\n\n**Syntax:** `Option Explicit`",
			],
			[
				"explicit",
				"Forces all variables to be explicitly declared with `Dim`, `Private`, `Public`, or `ReDim`.\n\n**Syntax:** `Option Explicit`",
			],

			// ── Conditionals ──
			[
				"if",
				"Conditionally executes a block of statements.\n\n**Syntax:**\n```vbscript\nIf condition Then\n    statements\n[ElseIf condition Then\n    statements]\n[Else\n    statements]\nEnd If\n```\n\nSingle-line form: `If condition Then statement [Else statement]`",
			],
			["then", "Part of the `If...Then...End If` conditional construct."],
			[
				"else",
				"Defines an alternative block to execute when the `If` condition is false.\n\nPart of `If...Then...Else...End If`.",
			],
			[
				"elseif",
				"Defines an additional condition to test within an `If` block.\n\n**Syntax:** `ElseIf condition Then`",
			],
			[
				"end",
				"Closes a block statement. Used as `End If`, `End Function`, `End Sub`, `End With`, `End Class`, `End Select`, `End Property`.",
			],
			[
				"select",
				"Evaluates an expression and executes one of several statement blocks depending on the value.\n\n**Syntax:**\n```vbscript\nSelect Case expression\n    Case value1\n        statements\n    Case value2\n        statements\n    Case Else\n        statements\nEnd Select\n```",
			],
			[
				"case",
				"Defines a value branch inside a `Select Case` block.\n\n`Case Else` is the default branch when no other case matches.",
			],

			// ── Loops ──
			[
				"for",
				"Executes a block of code a fixed number of times.\n\n**Syntax:**\n```vbscript\nFor counter = start To end [Step step]\n    statements\nNext\n```\n\nOr for collections:\n```vbscript\nFor Each element In group\n    statements\nNext\n```",
			],
			[
				"each",
				"Used with `For...Next` to iterate over elements in an array or collection.\n\n**Syntax:** `For Each element In group`",
			],
			[
				"to",
				"Specifies the upper bound in a `For` loop or `Dim` array declaration.",
			],
			[
				"step",
				"Specifies the increment (or decrement) for a `For` loop counter.\n\n**Example:** `For i = 10 To 1 Step -1`",
			],
			["next", "Marks the end of a `For` or `For Each` loop body."],
			[
				"do",
				"Starts a `Do...Loop` that repeats while or until a condition is met.\n\n**Syntax:** `Do [{While | Until} condition]` … `Loop` or `Do` … `Loop [{While | Until} condition]`",
			],
			[
				"loop",
				"Marks the end (and optional condition) of a `Do...Loop`.",
			],
			[
				"while",
				"Used with `Do` or as `While...Wend`. Repeats a block while a condition is true.\n\n**Syntax:** `While condition` … `Wend`",
			],
			["wend", "Marks the end of a `While...Wend` loop."],
			[
				"until",
				"Used with `Do...Loop Until` — repeats the loop body until the condition becomes true.",
			],
			[
				"exit",
				"Exits a `Do`, `For`, `Function`, `Property`, or `Sub` early.\n\n**Syntax:** `Exit Do | For | Function | Property | Sub`",
			],

			// ── Procedures ──
			[
				"sub",
				"Defines a subroutine — a named block of code with no return value.\n\n**Syntax:**\n```vbscript\n[Private | Public] Sub name([arglist])\n    statements\nEnd Sub\n```\n\nCall with `Call name(args)` or just `name args`.",
			],
			[
				"function",
				"Defines a function — a named block of code that returns a value. Assign to the function's name to set the return value.\n\n**Syntax:**\n```vbscript\n[Private | Public] Function name([arglist])\n    statements\n    name = returnValue\nEnd Function\n```",
			],
			[
				"call",
				"Calls a `Sub` or `Function`. The keyword is optional; parentheses are required when `Call` is used.\n\n**Syntax:** `Call name(args)` or `name args`",
			],
			[
				"byval",
				"Passes an argument **by value** — the procedure gets a copy; changes do not affect the caller.\n\n**Syntax:** `Sub name(ByVal arg)`",
			],
			[
				"byref",
				"Passes an argument **by reference** — the procedure operates on the original variable. This is the VBScript default.\n\n**Syntax:** `Sub name(ByRef arg)` or `Sub name(arg)`",
			],
			[
				"return",
				"Not a VBScript/ASP Classic keyword. Use the function-name assignment pattern to return values from functions.",
			],

			// ── Classes ──
			[
				"class",
				"Defines a class with properties, methods, and events.\n\n**Syntax:**\n```vbscript\nClass ClassName\n    Private/Public members\n    ...\nEnd Class\n```",
			],
			[
				"private",
				"Declares a variable, property, or method accessible only within the class or script module where it is declared.",
			],
			[
				"public",
				"Declares a variable, property, or method accessible from anywhere in the script.",
			],
			[
				"property",
				"Defines a class property procedure — `Property Get`, `Property Let`, or `Property Set`.\n\n**Syntax:**\n```vbscript\nProperty Get name\n    name = value\nEnd Property\nProperty Let name(val)\n    ...\nEnd Property\n```",
			],
			["get", "Used in `Property Get` to define a read accessor."],
			[
				"me",
				'Refers to the current class instance — analogous to `this` in other languages.\n\n**Example:** `Me.name = "value"`',
			],
			[
				"new",
				"Creates an instance of a class.\n\n**Syntax:** `Set obj = New ClassName`",
			],
			[
				"with",
				'Executes a series of statements on a single object without qualifying each statement.\n\n**Example:**\n```vbscript\nWith Response\n    .Write "Hello"\n    .End\nEnd With\n```',
			],

			// ── Error handling ──
			["on", "Used in `On Error` error-handling statements."],
			[
				"error",
				"Used in `On Error Resume Next` or `On Error GoTo 0`.\n\nSee also the `Err` built-in object.",
			],
			[
				"resume",
				"Used in `On Error Resume Next` — continues execution on the line after the one that caused the error.",
			],
			[
				"goto",
				"Used in `On Error GoTo 0` — disables any active error handler and re-enables normal error propagation.",
			],

			// ── Operators / logic ──
			[
				"and",
				"Logical AND operator. Returns `True` only if both operands are true.\n\n**Example:** `If a > 0 And b > 0 Then`",
			],
			[
				"or",
				"Logical OR operator. Returns `True` if at least one operand is true.\n\n**Example:** `If a = 1 Or b = 1 Then`",
			],
			[
				"not",
				"Logical NOT operator. Negates a boolean expression.\n\n**Example:** `If Not IsNull(x) Then`",
			],
			[
				"xor",
				"Logical exclusive-OR operator. Returns `True` if exactly one operand is true.",
			],
			[
				"eqv",
				"Logical equivalence operator. Returns `True` if both operands have the same logical value.",
			],
			[
				"imp",
				"Logical implication operator. Returns `True` unless the first operand is `True` and the second is `False`.",
			],
			[
				"mod",
				"Modulo operator — returns the integer remainder of division.\n\n**Example:** `remainder = 10 Mod 3  ' = 1`",
			],
			[
				"is",
				"Compares two object reference variables. Returns `True` if they refer to the same object.\n\n**Example:** `If obj Is Nothing Then`",
			],
			[
				"like",
				"Pattern-matching operator. Compares a string to a wildcard pattern where `*` matches any sequence, `?` matches one character.",
			],
			[
				"in",
				"Used in `For Each...In` to specify the collection to iterate over.",
			],

			// ── Type keywords ──
			["boolean", "Boolean data type — `True` or `False`."],
			["byte", "Byte data type — integer 0 through 255."],
			[
				"integer",
				"Integer data type — whole numbers −32 768 through 32 767.",
			],
			[
				"long",
				"Long integer data type — whole numbers −2 147 483 648 through 2 147 483 647.",
			],
			["single", "Single-precision floating-point data type."],
			["double", "Double-precision floating-point data type."],
			[
				"currency",
				"Fixed-point currency data type — scaled integer with four decimal places.",
			],
			[
				"date",
				"Date/time data type. Stores dates and times as a floating-point number.",
			],
			["string", "String data type — sequence of characters."],
			["object", "Object data type — holds a reference to any object."],
			[
				"variant",
				"The default VBScript data type that can hold any kind of data, automatically adjusting its subtype.",
			],
			[
				"type",
				"Defines a user-defined type (record/struct).\n\n**Syntax:**\n```vbscript\nType TypeName\n    field1 As DataType\n    ...\nEnd Type\n```",
			],
			[
				"typeof",
				"Tests whether an object variable is of a specific type.\n\n**Syntax:** `If TypeOf obj Is ClassName Then`",
			],
			["as", "Used in type declarations to specify the data type."],
			[
				"enum",
				"Declares an enumeration — a set of named integer constants.\n\n**Syntax:**\n```vbscript\nEnum Color\n    Red = 1\n    Green = 2\nEnd Enum\n```",
			],

			// ── Special values ──
			[
				"true",
				"Boolean literal **True** in VBScript. Numerically equal to `−1`.",
			],
			[
				"false",
				"Boolean literal **False** in VBScript. Numerically equal to `0`.",
			],
			[
				"nothing",
				"A special value used to disassociate an object variable from an actual object.\n\n**Example:** `Set obj = Nothing`",
			],
			[
				"empty",
				"A special variant value indicating that a variable has not been initialised. Distinct from `Null` and `Nothing`.",
			],
			[
				"null",
				"A special variant value indicating that a variable intentionally contains no valid data. Distinct from `Empty` and `Nothing`.",
			],

			// ── Other ──
			[
				"static",
				"Declares a local variable that retains its value between calls to the procedure.\n\n**Syntax:** `Static varname`",
			],
			[
				"stop",
				"Suspends execution — equivalent to a breakpoint. Has no effect in most deployed environments.",
			],
			[
				"rem",
				"Marks the rest of the line as a comment. Equivalent to using `'`.\n\n**Example:** `Rem This is a comment`",
			],
			[
				"shared",
				"Declares a module-level variable visible across all procedures in the module.",
			],
			[
				"raiseevent",
				"Fires an event declared within a class.\n\n**Syntax:** `RaiseEvent eventname[(arglist)]`",
			],
			[
				"event",
				"Declares a custom event within a class.\n\n**Syntax:** `[Public] Event eventname[(arglist)]`",
			],
			[
				"implements",
				"Specifies an interface or class that the current class implements.",
			],
			[
				"lset",
				"Left-aligns a string within a fixed-length string variable, padding with spaces on the right.",
			],
			[
				"rset",
				"Right-aligns a string within a fixed-length string variable, padding with spaces on the left.",
			],
		]);
	}
	return _keywordDocs;
}

// ─── Built-in ASP object documentation ───────────────────────────────────────
let _objectDocs: Map<string, string> | undefined;
function getObjectDocs(): Map<string, string> {
	if (!_objectDocs) {
		_objectDocs = new Map<string, string>([
			[
				"response",
				'**ASP built-in object** — controls what is sent back to the client.\n\n**Key members:**\n- `Response.Write(string)` — writes output to the response\n- `Response.Redirect(url)` — redirects the browser\n- `Response.End` — stops processing and sends the response\n- `Response.Flush` — sends buffered output immediately\n- `Response.Clear` — clears buffered output\n- `Response.Buffer` — enables/disables output buffering\n- `Response.ContentType` — sets the MIME type (e.g. `"text/html"`)\n- `Response.Charset` — sets the character set\n- `Response.StatusCode` — HTTP status code\n- `Response.AddHeader(name, value)` — adds an HTTP header\n- `Response.Cookies(name)` — sets a cookie value\n- `Response.Expires` — minutes until the page expires from browser cache\n- `Response.ExpiresAbsolute` — absolute expiration date\n- `Response.CacheControl` — sets the `Cache-Control` header\n- `Response.IsClientConnected` — checks if the client is still connected',
			],
			[
				"request",
				'**ASP built-in object** — provides access to the HTTP request from the client.\n\n**Key members:**\n- `Request.Form(name)` — reads a POST form field\n- `Request.QueryString(name)` — reads a URL query string parameter\n- `Request.Cookies(name)` — reads a cookie value\n- `Request.ServerVariables(name)` — reads a server variable (e.g. `"REMOTE_ADDR"`, `"HTTP_USER_AGENT"`)\n- `Request.TotalBytes` — total size of the request body in bytes\n- `Request.BinaryRead(count)` — reads raw bytes from the request body\n- `Request(name)` — searches Form, QueryString, Cookies, ServerVariables in order',
			],
			[
				"server",
				'**ASP built-in object** — provides utility methods for the server environment.\n\n**Key members:**\n- `Server.CreateObject(progid)` — creates a COM object instance (e.g. `"ADODB.Connection"`)\n- `Server.MapPath(path)` — converts a virtual path to a physical file-system path\n- `Server.HTMLEncode(string)` — encodes a string for safe HTML output\n- `Server.URLEncode(string)` — URL-encodes a string\n- `Server.Execute(path)` — executes another ASP file and includes its output\n- `Server.Transfer(path)` — transfers execution to another ASP file (no client redirect)\n- `Server.ScriptTimeout` — maximum seconds a script can run before timing out\n- `Server.GetLastError()` — returns an `ASPError` object describing the last error',
			],
			[
				"session",
				"**ASP built-in object** — stores user-specific data across multiple page requests.\n\n**Key members:**\n- `Session(name)` — gets/sets a session variable\n- `Session.SessionID` — unique identifier for the session\n- `Session.Timeout` — session inactivity timeout in minutes (default 20)\n- `Session.Abandon` — destroys the session and its data\n- `Session.CodePage` — code page used for strings in the session\n- `Session.LCID` — locale identifier for the session\n- `Session.Contents` — collection of all session variables\n- `Session.StaticObjects` — collection of objects created with `<OBJECT>` in Global.asa",
			],
			[
				"application",
				"**ASP built-in object** — stores data shared across all users and sessions in the application.\n\n**Key members:**\n- `Application(name)` — gets/sets an application-level variable\n- `Application.Lock` — prevents other sessions from modifying application variables\n- `Application.Unlock` — releases an application lock\n- `Application.Contents` — collection of all application variables\n- `Application.StaticObjects` — objects created with `<OBJECT>` in Global.asa\n- `Application.Contents.Remove(name)` — removes a variable\n- `Application.Contents.RemoveAll` — removes all variables",
			],
			[
				"err",
				"**VBScript built-in object** — contains information about the most recent runtime error. Used after `On Error Resume Next`.\n\n**Key members:**\n- `Err.Number` — error number (0 = no error)\n- `Err.Description` — text description of the error\n- `Err.Source` — object or application that generated the error\n- `Err.Clear` — resets the error object to defaults\n- `Err.Raise(number, source, description)` — programmatically raises an error\n- `Err.HelpFile` — path to the help file associated with the error\n- `Err.HelpContext` — help context ID",
			],
		]);
	}
	return _objectDocs;
}

// ─── Hover provider ───────────────────────────────────────────────────────────
export function registerAspHoverProvider(
	context: vscode.ExtensionContext,
): void {
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(
			{ language: "asp" },
			{
				provideHover(
					document: vscode.TextDocument,
					position: vscode.Position,
					token: vscode.CancellationToken,
				): Promise<vscode.Hover | undefined> {
					return new Promise((resolve) => {
						const timer = setTimeout(() => {
							const config = vscode.workspace.getConfiguration(
								"theToyBox.syntaxHighlighting",
							);
							if (
								!config.get<boolean>("enabled", true) ||
								!config.get<boolean>("asp", true)
							) {
								return resolve(undefined);
							}

							const wordRange = document.getWordRangeAtPosition(
								position,
								/[a-zA-Z_][a-zA-Z0-9_]*/,
							);
							if (!wordRange) {
								return resolve(undefined);
							}

							const word = document.getText(wordRange);
							const lower = word.toLowerCase();

							// Check built-in objects first (higher priority)
							const objDoc = getObjectDocs().get(lower);
							if (objDoc) {
								const md = new vscode.MarkdownString(objDoc);
								return resolve(new vscode.Hover(md, wordRange));
							}

							// Then check VBScript keywords
							const kwDoc = getKeywordDocs().get(lower);
							if (!kwDoc) {
								return resolve(undefined);
							}
							const md = new vscode.MarkdownString(
								`**VBScript keyword** \`${lower}\`\n\n${kwDoc}`,
							);
							return resolve(new vscode.Hover(md, wordRange));
						}, 400);

						token.onCancellationRequested(() => {
							clearTimeout(timer);
							resolve(undefined);
						});
					});
				},
			},
		),
	);
}
