/** @type {import('jest').Config} */
const config = {
	preset: "ts-jest/presets/default-esm",
	testEnvironment: "node",
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/__mocks__/obsidian.ts",
	},
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				useESM: true,
				tsconfig: {
					module: "ESNext",
					moduleResolution: "node",
				},
			},
		],
	},
	extensionsToTreatAsEsm: [".ts"],
};

export default config;
