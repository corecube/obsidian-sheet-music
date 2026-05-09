import { describe, expect, it } from "@jest/globals";
import {
	isSectionLine,
	splitChordsLines,
	tokenizeChordsLine,
} from "./renderer-logic";

describe("splitChordsLines", () => {
	it("normalizes windows newlines", () => {
		expect(splitChordsLines("[Verse 1]\r\n[C] hello")).toEqual([
			"[Verse 1]",
			"[C] hello",
		]);
	});
});

describe("isSectionLine", () => {
	it("returns true when a line contains only a bracket section token", () => {
		expect(isSectionLine("[Pre-Chorus]")).toBe(true);
		expect(isSectionLine("  [Verse 2]  ")).toBe(true);
	});

	it("returns false when bracket tokens are embedded in lyrics", () => {
		expect(isSectionLine("[C] hello [G] world")).toBe(false);
		expect(isSectionLine("Verse [1]")).toBe(false);
	});
});

describe("tokenizeChordsLine", () => {
	it("tokenizes lyric lines with inline chord tokens", () => {
		expect(tokenizeChordsLine("[C] hello [G] world")).toEqual([
			{ type: "bracket", value: "[C]" },
			{ type: "text", value: " hello " },
			{ type: "bracket", value: "[G]" },
			{ type: "text", value: " world" },
		]);
	});

	it("tokenizes chord-shape definitions", () => {
		expect(tokenizeChordsLine("Am[x02210]")).toEqual([
			{ type: "text", value: "Am" },
			{ type: "bracket", value: "[x02210]" },
		]);
	});

	it("returns a plain text token when no brackets are present", () => {
		expect(tokenizeChordsLine("No chord markers")).toEqual([
			{ type: "text", value: "No chord markers" },
		]);
	});
});
