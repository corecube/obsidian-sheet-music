import { describe, expect, it } from "@jest/globals";
import {
	TRANSLATION_PREFIX,
	chunkTexts,
	collectTranslatableLines,
	findChordsBlocks,
	insertTranslations,
	isTranslationLine,
	parseGtxResponse,
	stripChordMarkers,
} from "./translate-logic";

describe("isTranslationLine", () => {
	it("detects the translation prefix", () => {
		expect(isTranslationLine("> Hallo Welt")).toBe(true);
		expect(isTranslationLine("Hallo Welt")).toBe(false);
		expect(isTranslationLine(">no space")).toBe(false);
	});
});

describe("stripChordMarkers", () => {
	it("removes mid-word chords", () => {
		expect(stripChordMarkers("La luz de tu mirar[G], tu caminar")).toBe(
			"La luz de tu mirar, tu caminar",
		);
	});

	it("removes multiple chords", () => {
		expect(stripChordMarkers("[C] hello [G] world")).toBe(" hello  world");
	});

	it("keeps lines without chords unchanged", () => {
		expect(stripChordMarkers("just lyrics")).toBe("just lyrics");
	});

	it("returns nothing for chord-only lines", () => {
		expect(stripChordMarkers("[C][G][Am]")).toBe("");
	});
});

describe("collectTranslatableLines", () => {
	it("skips blank, section, custom-def and translation lines", () => {
		const source = [
			"Am[x02210]",
			"[Verse 1]",
			"",
			"[C] La luz de tu [G]mirar",
			"> Das Licht deines Blickes",
			"[Am] No existe nadie como [C]tú",
		].join("\n");
		expect(collectTranslatableLines(source)).toEqual([
			{ index: 3, text: " La luz de tu mirar" },
			{ index: 5, text: " No existe nadie como tú" },
		]);
	});

	it("skips lines that are only chords", () => {
		expect(collectTranslatableLines("[C] [G]")).toEqual([]);
	});
});

describe("insertTranslations", () => {
	const source = ["[Verse 1]", "[C] Hola [G]mundo", "", "Otra línea"].join(
		"\n",
	);
	const entries = [
		{ index: 1, text: " Hola mundo" },
		{ index: 3, text: "Otra línea" },
	];

	it("inserts a translation line under each lyric line", () => {
		expect(insertTranslations(source, entries, ["Hallo Welt", "Andere Zeile"]))
			.toBe(
				[
					"[Verse 1]",
					"[C] Hola [G]mundo",
					"> Hallo Welt",
					"",
					"Otra línea",
					"> Andere Zeile",
				].join("\n"),
			);
	});

	it("replaces existing translations instead of duplicating", () => {
		const once = insertTranslations(source, entries, [
			"Hallo Welt",
			"Andere Zeile",
		]);
		const entriesAgain = collectTranslatableLines(once);
		const twice = insertTranslations(once, entriesAgain, [
			"Hello world",
			"Other line",
		]);
		expect(twice).toBe(
			[
				"[Verse 1]",
				"[C] Hola [G]mundo",
				"> Hello world",
				"",
				"Otra línea",
				"> Other line",
			].join("\n"),
		);
	});

	it("handles translations containing bracket-like text", () => {
		const out = insertTranslations("Hola", [{ index: 0, text: "Hola" }], [
			"Hallo [sic]",
		]);
		expect(out).toBe("Hola\n> Hallo [sic]");
	});

	it("appends after a lyric on the last line", () => {
		const out = insertTranslations(
			"[C]Adiós",
			[{ index: 0, text: "Adiós" }],
			["Tschüss"],
		);
		expect(out).toBe("[C]Adiós\n> Tschüss");
	});
});

describe("parseGtxResponse", () => {
	it("concatenates translated segments", () => {
		const json = [
			[
				["Hallo\n", "hello\n", null, null, 10],
				["Welt", "world", null, null, 10],
			],
			null,
			"en",
		];
		expect(parseGtxResponse(json)).toBe("Hallo\nWelt");
	});

	it("throws on malformed responses", () => {
		expect(() => parseGtxResponse(null)).toThrow();
		expect(() => parseGtxResponse({})).toThrow();
		expect(() => parseGtxResponse([])).toThrow();
	});
});

describe("chunkTexts", () => {
	it("keeps everything in one chunk when small", () => {
		expect(chunkTexts(["a", "b", "c"])).toEqual([["a", "b", "c"]]);
	});

	it("splits when the encoded budget is exceeded", () => {
		const chunks = chunkTexts(["aaaa", "bbbb", "cccc"], 10);
		expect(chunks).toEqual([["aaaa"], ["bbbb"], ["cccc"]]);
	});

	it("gives an oversized line its own chunk and preserves order", () => {
		const chunks = chunkTexts(["short", "x".repeat(50), "tail"], 20);
		expect(chunks.flat()).toEqual(["short", "x".repeat(50), "tail"]);
		expect(chunks[1]).toEqual(["x".repeat(50)]);
	});
});

describe("findChordsBlocks", () => {
	it("finds a single chords block", () => {
		const lines = ["# Song", "```chords", "[C] Hola", "```", "text"];
		expect(findChordsBlocks(lines)).toEqual([{ start: 1, end: 3 }]);
	});

	it("finds multiple blocks", () => {
		const lines = [
			"```chords",
			"[C] uno",
			"```",
			"",
			"```chords",
			"[G] dos",
			"```",
		];
		expect(findChordsBlocks(lines)).toEqual([
			{ start: 0, end: 2 },
			{ start: 4, end: 6 },
		]);
	});

	it("ignores non-chords fences", () => {
		const lines = ["```js", "code", "```", "```", "plain", "```"];
		expect(findChordsBlocks(lines)).toEqual([]);
	});

	it("drops unclosed chords fences", () => {
		expect(findChordsBlocks(["```chords", "[C] Hola"])).toEqual([]);
	});

	it("skips chords fences quoted inside longer fences", () => {
		const lines = [
			"````md",
			"```chords",
			"[C] Hola",
			"```",
			"````",
			"```chords",
			"[G] real",
			"```",
		];
		expect(findChordsBlocks(lines)).toEqual([{ start: 5, end: 7 }]);
	});

	it("allows trailing whitespace but not other suffixes", () => {
		expect(findChordsBlocks(["```chords  ", "x", "```"])).toEqual([
			{ start: 0, end: 2 },
		]);
		expect(findChordsBlocks(["```chordsx", "x", "```"])).toEqual([]);
	});
});

describe("TRANSLATION_PREFIX", () => {
	it("is the reserved '> ' prefix", () => {
		expect(TRANSLATION_PREFIX).toBe("> ");
	});
});
