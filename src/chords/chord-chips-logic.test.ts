import { describe, expect, it } from "@jest/globals";
import {
	buildChordChipsModel,
	collectBlockChords,
	romanNumeralFor,
	transposeBlockInNote,
} from "./chord-chips-logic";
import { transposeSource } from "./transpose";

const BLOCK = [
	"Am[x02210]",
	"[Verse 1]",
	"[C] la [G] la [Am] la",
	"> translation [D] here",
	"[Chorus]",
	"[F] la [C] la",
].join("\n");

describe("romanNumeralFor", () => {
	it("returns null without a key", () => {
		expect(romanNumeralFor("", "Am")).toBeNull();
		expect(romanNumeralFor("   ", "Am")).toBeNull();
	});

	it("analyses chords in a major key", () => {
		expect(romanNumeralFor("C", "Am")).toBe("VIm");
		expect(romanNumeralFor("C", "G")).toBe("V");
	});

	it("uses the tonic of a minor key", () => {
		expect(romanNumeralFor("Am", "Am")).toBe("Im");
		expect(romanNumeralFor("Am", "E")).toBe("V");
	});

	it("returns null when the numeral equals the chord name", () => {
		expect(romanNumeralFor("X", "X")).toBeNull();
	});
});

describe("collectBlockChords", () => {
	it("collects deduplicated chord names in order of first appearance", () => {
		expect(collectBlockChords(BLOCK).names).toEqual(["Am", "C", "G", "F"]);
	});

	it("skips section headers, translation lines and fret strings", () => {
		const { names } = collectBlockChords(BLOCK);
		expect(names).not.toContain("Verse 1");
		expect(names).not.toContain("Chorus");
		expect(names).not.toContain("D");
		expect(names).not.toContain("x02210");
	});

	it("keeps custom voicings keyed by chord name", () => {
		expect([...collectBlockChords(BLOCK).customDefs.keys()]).toEqual(["Am"]);
	});

	it("returns nothing for a block without chords", () => {
		expect(collectBlockChords("just lyrics\nmore lyrics").names).toEqual([]);
	});
});

describe("buildChordChipsModel", () => {
	it("adds numerals when a key is given", () => {
		const model = buildChordChipsModel(BLOCK, "C");
		expect(model.numerals.get("C")).toBe("I");
		expect(model.numerals.get("G")).toBe("V");
		expect(model.numerals.get("Am")).toBe("VIm");
		expect(model.numerals.get("F")).toBe("IV");
	});

	it("has no numerals without a key", () => {
		expect(buildChordChipsModel(BLOCK, "").numerals.size).toBe(0);
	});
});

describe("transposeBlockInNote", () => {
	const NOTE = [
		"---",
		"key: C",
		"---",
		"```chords",
		"[C] la [G] la",
		"```",
		"",
		"```chords",
		"[F] la",
		"```",
	].join("\n");

	it("transposes only the addressed block", () => {
		const out = transposeBlockInNote(NOTE, 3, 5, 2, transposeSource);
		expect(out).toContain("[D] la [A] la");
		expect(out).toContain("[F] la");
		expect(out).toContain("key: C");
		expect(out.split("\n")).toHaveLength(NOTE.split("\n").length);
	});

	it("returns the input unchanged for zero semitones or bad ranges", () => {
		expect(transposeBlockInNote(NOTE, 3, 5, 0, transposeSource)).toBe(NOTE);
		expect(transposeBlockInNote(NOTE, 5, 5, 2, transposeSource)).toBe(NOTE);
		expect(transposeBlockInNote(NOTE, 3, 99, 2, transposeSource)).toBe(NOTE);
	});
});
