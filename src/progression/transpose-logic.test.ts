import { describe, expect, it } from "@jest/globals";
import { spellForKey, transposeChordToken, transposeKeyToken, transposeProgressionSource } from "./transpose-logic";

describe("transposeKeyToken", () => {
	it("moves major and minor keys in every spelling", () => {
		expect(transposeKeyToken("G", 2)).toBe("A");
		expect(transposeKeyToken("Am", 1)).toBe("Bbm");
		expect(transposeKeyToken("C:", 7)).toBe("G:");
		expect(transposeKeyToken("a:", 2)).toBe("b:");
		expect(transposeKeyToken("f#:", 1)).toBe("g:");
		expect(transposeKeyToken("B-:", 1)).toBe("B:");
	});

	it("simplifies awkward spellings", () => {
		expect(transposeKeyToken("E", 1)).toBe("F");
		expect(transposeKeyToken("B", 1)).toBe("C");
	});

	it("prefers the enharmonic key with the smaller key signature", () => {
		expect(transposeKeyToken("B", -1)).toBe("Bb"); // not A# major (10 sharps)
		expect(transposeKeyToken("A", 1)).toBe("Bb");
		expect(transposeKeyToken("C", 1)).toBe("Db"); // 5 flats beats 7 sharps
		expect(transposeKeyToken("F", 1)).toBe("Gb"); // tie with F#: keep the computed spelling
		expect(transposeKeyToken("Am", 1)).toBe("Bbm"); // 5 flats beats A# minor's 7 sharps
		expect(transposeKeyToken("Gm", 1)).toBe("G#m"); // 5 sharps beats Ab minor's 7 flats
		expect(transposeKeyToken("Dm", 1)).toBe("Ebm"); // 6 flats, tie with D# minor
	});
});

describe("transposeChordToken", () => {
	it("moves chord names and slash basses", () => {
		expect(transposeChordToken("G7/B", 2)).toBe("A7/C#");
		expect(transposeChordToken("Dm", 5)).toBe("Gm");
		expect(transposeChordToken("Bm7b5", 1)).toBe("Cm7b5");
	});

	it("spells roots and basses for the target key", () => {
		const E = { tonic: "E", minor: false };
		expect(transposeChordToken("Gm7", 1, E)).toBe("G#m7");
		expect(transposeChordToken("Dm7", 1, E)).toBe("D#m7");
		expect(transposeChordToken("C/E", 4, E)).toBe("E/G#");
		const F = { tonic: "F", minor: false };
		expect(transposeChordToken("A", 1, F)).toBe("Bb");
		expect(transposeChordToken("C#", 2, F)).toBe("Eb"); // chromatic in F: flats
		const A = { tonic: "A", minor: false };
		expect(transposeChordToken("C", 1, A)).toBe("C#"); // chromatic in A: sharps
	});
});

describe("spellForKey", () => {
	it("prefers diatonic spellings, then the key's accidental direction", () => {
		expect(spellForKey("Ab", { tonic: "E", minor: false })).toBe("G#");
		expect(spellForKey("G#", { tonic: "Eb", minor: false })).toBe("Ab");
		expect(spellForKey("D#", { tonic: "C", minor: false })).toBe("Eb");
		expect(spellForKey("Bb", { tonic: "A", minor: true })).toBe("Bb");
		expect(spellForKey("C##", null)).toBe("D");
	});
});

describe("transposeProgressionSource", () => {
	it("changes the key line and leaves numerals alone", () => {
		expect(transposeProgressionSource("C\nI ii V7 I", 2)).toBe("D\nI ii V7 I");
	});

	it("moves chord names but not numerals in mixed rows", () => {
		expect(transposeProgressionSource("C\nI Am F V", 2)).toBe("D\nI Bm G V");
	});

	it("respells chord names for the new key", () => {
		expect(transposeProgressionSource("D\nD A F#m7 C#m7", 2)).toBe("E\nE B G#m7 D#m7");
		expect(transposeProgressionSource("E\nE B G#m7 D#m7", -1)).toBe("Eb\nEb Bb Gm7 Dm7");
	});

	it("moves inline key tokens and keeps everything else, including whitespace and comments", () => {
		const source = [
			"Composer: J. S. Bach   # header stays",
			"m0 b3 G: I               # key with colon",
			"m1 b2 IV6 b3 V6",
			"m8 vi C: ii   # pivot into C",
			"m9-10 = m1-2",
		].join("\n");
		expect(transposeProgressionSource(source, 2)).toBe(
			[
				"Composer: J. S. Bach   # header stays",
				"m0 b3 A: I               # key with colon",
				"m1 b2 IV6 b3 V6",
				"m8 vi D: ii   # pivot into C",
				"m9-10 = m1-2",
			].join("\n"),
		);
	});

	it("does not treat the abbreviations Cad64, Ger65 and Fr43 as chord names", () => {
		expect(transposeProgressionSource("C\nCad64 Ger65 Fr43 N6", 2)).toBe("D\nCad64 Ger65 Fr43 N6");
	});

	it("keeps NC and legacy numerals", () => {
		expect(transposeProgressionSource("Am\nIm NC IVm V", 3)).toBe("Cm\nIm NC IVm V");
	});

	it("finds the key line behind a leading comment or metadata", () => {
		expect(transposeProgressionSource("# intro\na\nI iv V", 2)).toBe("# intro\nb\nI iv V");
		expect(transposeProgressionSource("Composer: X\nAm\nI Dm", 2)).toBe("Composer: X\nBm\nI Em");
	});

	it("returns the source unchanged for zero semitones", () => {
		expect(transposeProgressionSource("C\nI", 0)).toBe("C\nI");
	});
});
