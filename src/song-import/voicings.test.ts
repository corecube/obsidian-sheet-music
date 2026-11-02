import { describe, expect, it } from "@jest/globals";
import { voicingSpellsChord } from "./voicings";

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
