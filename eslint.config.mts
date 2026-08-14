import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
				// Ambient DOM helpers declared globally by obsidian.d.ts
				createEl: "readonly",
				createDiv: "readonly",
				createSpan: "readonly",
				createSvg: "readonly",
				createFragment: "readonly",
				activeWindow: "readonly",
				activeDocument: "readonly",
			},
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// The sentence-case rule has no acronym exceptions; we deliberately keep
		// "ABC" and "MIDI" capitalized per Obsidian's published style guide.
		files: ["src/settings.ts", "src/midi-capture/renderer.ts", "src/midi-capture/player-renderer.ts", "src/piano-monitor/view.ts"],
		rules: {
			"obsidianmd/ui/sentence-case": "off",
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"coverage/**",
		"__mocks__/**",
	]),
);
