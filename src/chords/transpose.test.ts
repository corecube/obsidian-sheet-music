import { describe, expect, it } from "@jest/globals";
import { transposeSource } from "./transpose";

describe("transposeSource", () => {
	it("returns source unchanged when semitones is 0", () => {
		const source = "[Am] [C] [G]";
		expect(transposeSource(source, 0)).toBe(source);
	});

	it("transposes a simple chord up one semitone", () => {
		expect(transposeSource("[Am]", 1)).toBe("[Bbm]");
	});

	it("transposes a simple chord down one semitone", () => {
		// G#m and Abm are enharmonically equivalent — both are correct
		expect(transposeSource("[Am]", -1)).toMatch(/\[(G#m|Abm)\]/);
	});

	it("transposes multiple chords on one line", () => {
		expect(transposeSource("[Am] [C] [G]", 2)).toBe("[Bm] [D] [A]");
	});

	it("preserves section headers unchanged", () => {
		expect(transposeSource("[Verse 1]", 1)).toBe("[Verse 1]");
		expect(transposeSource("[Chorus]", 3)).toBe("[Chorus]");
	});

	it("preserves fret definitions unchanged", () => {
		expect(transposeSource("[x02210]", 1)).toBe("[x02210]");
		expect(transposeSource("[320003]", -1)).toBe("[320003]");
	});

	it("preserves non-bracketed lyrics and only transposes chords", () => {
		const source = "Some lyrics with [Am] chords [G] in them";
		expect(transposeSource(source, 1)).toBe(
			"Some lyrics with [Bbm] chords [Ab] in them",
		);
	});

	it("transposes across multiple lines", () => {
		const source = "[Verse 1]\n[Am] [C]\n[G] [Em]";
		expect(transposeSource(source, 2)).toBe("[Verse 1]\n[Bm] [D]\n[A] [F#m]");
	});

	it("transposes a full octave (+12) back to the same chord", () => {
		const source = "[Am] [C] [F#m]";
		expect(transposeSource(source, 12)).toBe(source);
	});

	it("transposes down a full octave (-12) back to the same chord", () => {
		const source = "[Am] [C] [F#m]";
		expect(transposeSource(source, -12)).toBe(source);
	});

	// Bug regression tests: repeated transpositions must not accumulate double-flats/sharps
	it("does not accumulate double-flats on repeated +1 transposes", () => {
		let source = "[Am]";
		source = transposeSource(source, 1);
		expect(source).toBe("[Bbm]");
		source = transposeSource(source, 1);
		// Must be Bm — not Cbm (double-flat accumulation)
		expect(source).toBe("[Bm]");
		source = transposeSource(source, 1);
		expect(source).toBe("[Cm]");
		source = transposeSource(source, 1);
		// C#m or Dbm are both valid
		expect(source).toMatch(/\[(C#m|Dbm)\]/);
	});

	it("does not accumulate double-sharps on repeated -1 transposes", () => {
		let source = "[C]";
		source = transposeSource(source, -1);
		expect(source).toBe("[B]");
		source = transposeSource(source, -1);
		// Bb or A# are both valid
		expect(source).toMatch(/\[(Bb|A#)\]/);
		source = transposeSource(source, -1);
		// Must be A — not G## (double-sharp accumulation)
		expect(source).toBe("[A]");
		source = transposeSource(source, -1);
		// Ab or G# are both valid
		expect(source).toMatch(/\[(Ab|G#)\]/);
	});

	it("cycles cleanly through all 12 semitones and returns to start", () => {
		let source = "[Am]";
		for (let i = 0; i < 12; i++) {
			source = transposeSource(source, 1);
		}
		expect(source).toBe("[Am]");
	});

	it("handles major chords", () => {
		expect(transposeSource("[C]", 4)).toBe("[E]");
		expect(transposeSource("[G]", 5)).toBe("[C]");
	});

	it("handles seventh chords", () => {
		expect(transposeSource("[G7]", 1)).toMatch(/\[(Ab7|G#7)\]/);
		expect(transposeSource("[Cmaj7]", 2)).toBe("[Dmaj7]");
	});

	it("handles sharp chords", () => {
		expect(transposeSource("[F#m]", 1)).toBe("[Gm]");
		expect(transposeSource("[C#]", 1)).toBe("[D]");
	});

	it("handles flat chords", () => {
		expect(transposeSource("[Bb]", 2)).toBe("[C]");
		// Gbm and F#m are enharmonically equivalent — both are correct
		expect(transposeSource("[Ebm]", 3)).toMatch(/\[(F#m|Gbm)\]/);
	});

	it("handles empty source", () => {
		expect(transposeSource("", 1)).toBe("");
	});

	it("handles source with no chords", () => {
		const source = "Just some lyrics\nwith no brackets at all";
		expect(transposeSource(source, 3)).toBe(source);
	});
});
