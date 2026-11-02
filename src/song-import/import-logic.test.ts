import { describe, expect, it } from "@jest/globals";
import {
	buildNote,
	looksLikeUrl,
	nextAvailablePath,
	sheetToLines,
	slugify,
	songFromPastedText,
	strummingBlock,
	voicingLines,
} from "./import-logic";

describe("looksLikeUrl", () => {
	it("accepts a single-line http(s) link only", () => {
		expect(looksLikeUrl("https://example.com/tab")).toBe(true);
		expect(looksLikeUrl("  http://example.com  ")).toBe(true);
		expect(looksLikeUrl("Am C G")).toBe(false);
		expect(looksLikeUrl("https://example.com/x\nAm C")).toBe(false);
	});
});

describe("songFromPastedText", () => {
	it("consumes header lines", () => {
		const song = songFromPastedText(
			"\nLet It Be chords by The Beatles\nKey: c\nCapo: 2\nTuning: Standard\nC G\nWhen I\n",
		);
		expect(song).toEqual({
			title: "Let It Be",
			artist: "The Beatles",
			key: "C",
			capo: 2,
			tuning: "Standard",
			sheet: "C G\nWhen I\n",
		});
	});

	it("keeps the text untouched without a header", () => {
		expect(songFromPastedText("Am C\nla la")).toEqual({
			title: "",
			artist: "",
			sheet: "Am C\nla la",
		});
	});
});

describe("sheetToLines", () => {
	const sheet = "[ch]C[/ch]  [ch]C[/ch]\nla la\n[ch]C[/ch]\nla";

	it("converts and drops repeated chords when asked", () => {
		expect(sheetToLines(sheet, { dropRepeatedChords: true })).toEqual([
			"[C]la la",
			"la",
		]);
		expect(sheetToLines(sheet, { dropRepeatedChords: false })).toEqual([
			"[C]la [C]la",
			"[C]la",
		]);
	});

	it("rejects text without chords", () => {
		expect(() => sheetToLines("just words\nmore words", { dropRepeatedChords: true })).toThrow(
			"No chords found in the text.",
		);
	});
});

describe("voicingLines", () => {
	it("lists voicings for the chords used, in order of appearance", () => {
		expect(
			voicingLines(
				["[Verse 1]", "[C] la [G] la", "[Am] la [C] la [Dm] la"],
				{ Am: "x02210", C: "x32010", G: "320003", E: "022100" },
			),
		).toEqual(["C[x32010]", "G[320003]", "Am[x02210]"]);
		expect(voicingLines(["[C] la"], undefined)).toEqual([]);
	});
});

describe("strummingBlock", () => {
	it("renders a pattern without optional fields", () => {
		expect(
			strummingBlock({ denominator: 16, isTriplet: true, measures: [1, 202] }),
		).toBe(
			'```strumming\n{\n    "denominator": 16,\n    "isTriplet": true,\n    "measures": [1, 202]\n}\n```\n',
		);
	});
});

describe("buildNote", () => {
	it("names the file and writes frontmatter plus the blocks", () => {
		const note = buildNote({
			song: {
				title: "Let It Be",
				artist: "The Beatles",
				sheet: "",
				source: "ultimate-guitar",
				url: "https://tabs.ultimate-guitar.com/tab/x",
				key: "C",
				capo: 2,
				tuning: "Standard",
				strummings: [
					{
						part: "Verse",
						bpm: 96,
						denominator: 8,
						isTriplet: false,
						measures: [1, 101, 1, 101, 1, 101, 1, 101],
					},
				],
				voicings: { C: "x32010", G: "320003" },
			},
			lines: ["[Verse]", "[C]la"],
		});
		expect(note.fileName).toBe("the_beatles-let_it_be.md");
		expect(note.content).toBe(
			[
				"---",
				"tags:",
				"type: tab",
				"autoscroll-speed: 5",
				"title: Let It Be",
				"artist: The Beatles",
				"ultimateguitar: https://tabs.ultimate-guitar.com/tab/x",
				"guitartuna:",
				"spotify:",
				"youtube:",
				"status: todo",
				"key: C",
				"capo: 2",
				"tempo: 96",
				"---",
				"",
				"```strumming",
				"{",
				'    "part": "Verse",',
				'    "bpm": 96,',
				'    "denominator": 8,',
				'    "isTriplet": false,',
				'    "measures": [1, 101, 1, 101, 1, 101, 1, 101]',
				"}",
				"```",
				"",
				"```chords",
				"C[x32010]",
				"",
				"[Verse]",
				"[C]la",
				"```",
				"",
			].join("\n"),
		);
	});

	it("slugs accents and punctuation and quotes values YAML would misread", () => {
		const note = buildNote({
			song: {
				title: "Eres: Live #2",
				artist: "Café Tacvba",
				sheet: "",
				key: "F#m",
				tuning: "Drop D",
			},
			lines: ["la"],
		});
		expect(note.fileName).toBe("cafe_tacvba-eres_live_2.md");
		expect(note.content).toContain('title: "Eres: Live #2"');
		expect(note.content).toContain("artist: Café Tacvba");
		expect(note.content).toContain("key: F#m");
		expect(note.content).toContain("ultimateguitar:\n");
		expect(note.content).toContain("capo:\n");
		expect(note.content).toContain("tempo:\n");
		expect(note.content).not.toContain("tuning");
	});

	it("leaves the link field empty for an unknown source", () => {
		const note = buildNote({
			song: { title: "", artist: "", sheet: "", url: "https://x/y" },
			lines: ["la"],
		});
		expect(note.content).toContain("ultimateguitar:\n");
	});

	it("falls back when artist and song are unknown", () => {
		const note = buildNote({
			song: { title: "", artist: "", sheet: "" },
			lines: ["la"],
		});
		expect(note.fileName).toBe("imported_song.md");
		expect(note.content).toBe(
			"---\ntags:\ntype: tab\nautoscroll-speed: 5\ntitle:\nartist:\nultimateguitar:\nguitartuna:\nspotify:\nyoutube:\nstatus: todo\nkey:\ncapo:\ntempo:\n---\n\n```chords\nla\n```\n",
		);
	});

	it("slugify handles edge cases", () => {
		expect(slugify("  The  Beatles! ")).toBe("the_beatles");
		expect(slugify("Álvaro Soler")).toBe("alvaro_soler");
		expect(slugify("---")).toBe("");
	});
});

describe("nextAvailablePath", () => {
	it("adds a numeric suffix until the path is free", () => {
		const taken = new Set(["Songs/x.md", "Songs/x-2.md"]);
		expect(nextAvailablePath("Songs", "x.md", (p) => taken.has(p))).toBe(
			"Songs/x-3.md",
		);
	});

	it("handles the vault root", () => {
		expect(nextAvailablePath("", "x.md", () => false)).toBe("x.md");
		expect(nextAvailablePath("/", "x.md", () => false)).toBe("x.md");
	});
});
