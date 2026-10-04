import { describe, expect, it } from "@jest/globals";
import {
	chordsBodyRanges,
	chordsHighlights,
	highlightLine,
} from "./editor-highlight-logic";

describe("chordsBodyRanges", () => {
	it("finds the body of closed chords blocks only", () => {
		const lines = [
			"# Song",
			"```chords",
			"[C] la",
			"[G] la",
			"```",
			"```abc",
			"X:1",
			"```",
			"````chords",
			"[Am]",
			"````",
		];
		expect(chordsBodyRanges(lines)).toEqual([
			[2, 3],
			[9, 9],
		]);
	});

	it("extends an unclosed chords fence to the end of the document", () => {
		expect(chordsBodyRanges(["```chords", "[C] la", "[G]"])).toEqual([
			[1, 2],
		]);
	});

	it("skips empty blocks", () => {
		expect(chordsBodyRanges(["```chords", "```"])).toEqual([]);
	});
});

describe("highlightLine", () => {
	it("marks brackets and chord names", () => {
		expect(highlightLine("la [Am] la")).toEqual({
			translation: false,
			section: false,
			spans: [
				{ from: 3, to: 4, cls: "bracket" },
				{ from: 4, to: 6, cls: "chord" },
				{ from: 6, to: 7, cls: "bracket" },
			],
		});
	});

	it("marks section headers", () => {
		const hl = highlightLine("[Verse 1]");
		expect(hl.section).toBe(true);
		expect(hl.spans[1]).toEqual({ from: 1, to: 8, cls: "section" });
	});

	it("flags translation lines without spans", () => {
		expect(highlightLine("> hello [C]")).toEqual({
			translation: true,
			section: false,
			spans: [],
		});
	});
});

describe("chordsHighlights", () => {
	it("limits output to the requested line window", () => {
		const lines = ["```chords", "[C]", "[D]", "[E]", "```"];
		expect(chordsHighlights(lines, 2, 2).map((h) => h.line)).toEqual([2]);
		expect(chordsHighlights(lines, 0, 10).map((h) => h.line)).toEqual([
			1, 2, 3,
		]);
	});
});
