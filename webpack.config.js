//@ts-check

"use strict";

const fs = require("fs");
const path = require("path");

class CopyMermaidBrowserBundlePlugin {
	apply(compiler) {
		compiler.hooks.afterEmit.tap("CopyMermaidBrowserBundlePlugin", () => {
			const source = require.resolve("mermaid/dist/mermaid.min.js");
			const destination = path.resolve(compiler.options.output.path, "assets", "mermaid.min.js");
			fs.mkdirSync(path.dirname(destination), { recursive: true });
			fs.copyFileSync(source, destination);
		});
	}
}

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
	target: "node", // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

	entry: "./src/extension.ts", // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
	output: {
		// the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
		path: path.resolve(__dirname, "dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2",
		clean: true,
	},
	externals: {
		vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
		// modules added here also need to be added in the .vscodeignore file
	},
	resolve: {
		// support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
		extensions: [".ts", ".js"],
		// Allow importing TS files using the .js extension (required for ESM
		// compatibility: source uses .js in imports so the compiled output works
		// in Node.js ESM, and webpack resolves .js → .ts here).
		extensionAlias: {
			".js": [".ts", ".js"],
		},
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: "ts-loader",
					},
				],
			},
		],
	},
	plugins: [new CopyMermaidBrowserBundlePlugin()],
	devtool: "nosources-source-map",
	infrastructureLogging: {
		level: "log", // enables logging required for problem matchers
	},
};
module.exports = [extensionConfig];
