import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
	{
		label: 'default',
		files: ['out/test/**/*.test.js', '!out/test/blockedChangesActivation.test.js'],
	},
	{
		label: 'git-disabled',
		files: 'out/test/blockedChangesActivation.test.js',
		workspaceFolder: 'src/test/fixtures/blocked-changes-workspace',
		launchArgs: ['--disable-extension=vscode.git'],
		env: { TOYBOX_TEST_GIT_DISABLED: '1' },
	},
	{
		label: 'multi-root',
		files: 'out/test/blockedChangesMultiRoot.test.js',
		workspaceFolder: 'src/test/fixtures/blocked-changes.code-workspace',
		env: { TOYBOX_TEST_MULTI_ROOT: '1' },
	},
]);
