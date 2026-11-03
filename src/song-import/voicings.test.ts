import { describe, expect, it } from "@jest/globals";
import { fretString, spelledFretString, voicingSpellsChord } from "./voicings";

describe("voicingSpellsChord", () => {
	it("accepts standard voicings and rejects wrong ones", () => {
		expect(voicingSpellsChord([-1, 0, 2, 2, 1, 0], "Am")).toBe(true);
		expect(voicingSpellsChord([-1, 3, 2, 0, 1, 0], "C")).toBe(true);
		expect(voicingSpellsChord([-1, -1, 0, 2, 3, 2], "D")).toBe(true);
		expect(voicingSpellsChord([0, 2, 2, 1, 0, 0], "E")).toBe(true);
		expect(voicingSpellsChord([-1, 2, 2, 2, -1, -1], "D5")).toBe(false);
		expect(voicingSpellsChord([0, 1, 2, 2, 1, 0], "Am")).toBe(false);
		expect(voicingSpellsChord([-1, 0, 2, 2, 1, 0], "C")).toBe(false);
		expect(voicingSpellsChord([2, 0, 0, 0], "Am")).toBe(true);
		expect(voicingSpellsChord([0, 0, 0, 3], "C")).toBe(true);
		expect(voicingSpellsChord([-1, 0, 2, 2, 1, 0], "N.C.")).toBe(false);
	});

	it("tolerates one missing chord tone but not a missing root", () => {
		expect(voicingSpellsChord([-1, -1, 0, 1, 0, -1], "Cmaj7")).toBe(false);
		expect(voicingSpellsChord([-1, 3, 2, 0, 0, 0], "Cmaj7")).toBe(true);
	});
});

describe("fretString", () => {
	it("writes the compact form up to the 9th fret and the listed form above", () => {
		expect(fretString([-1, 3, 2, 0, 1, 0])).toBe("x32010");
		expect(fretString([-1, 10, 9, 10, 8, -1])).toBe("x,10,9,10,8,x");
	});
});

describe("spelledFretString", () => {
	it("keeps voicings from the 10th fret up", () => {
		expect(spelledFretString("G7", [-1, 10, 9, 10, 8, -1])).toBe(
			"x,10,9,10,8,x",
		);
		expect(spelledFretString("C", [8, 10, 10, 9, 8, 8])).toBe("8,10,10,9,8,8");
		expect(spelledFretString("C", [-1, 3, 2, 0, 1, 0])).toBe("x32010");
	});
});
