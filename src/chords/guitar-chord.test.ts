import { describe, expect, it } from "@jest/globals";
import {
	lookupChord,
	lookupFrettedChord,
	lookupUkuleleChord,
	parseCustomChordDefs,
} from "./guitar-chord";

describe("lookupFrettedChord", () => {
	it("looks up guitar voicings with six strings", () => {
		const chord = lookupChord("C");
		expect(chord?.fingers).toHaveLength(6);
		expect(Math.max(...chord!.fingers.map(([s]) => s))).toBe(6);
	});

	it("looks up ukulele voicings with four strings", () => {
		const chord = lookupUkuleleChord("C");
		expect(chord?.title).toBe("C");
		expect(chord?.fingers).toHaveLength(4);
		expect(Math.max(...chord!.fingers.map(([s]) => s))).toBe(4);
		// Standard C on a ukulele: 0003 (string 1 fretted at 3).
		expect(chord?.fingers.find(([s]) => s === 1)?.[1]).toBe(3);
	});

	it("maps ukulele barres onto four strings", () => {
		const chord = lookupFrettedChord("Bb", "ukulele");
		expect(chord).not.toBeNull();
		for (const barre of chord!.barres) {
			expect(barre.fromString).toBeLessThanOrEqual(4);
			expect(barre.toString).toBeGreaterThanOrEqual(1);
		}
	});

	it("returns null for unknown chords", () => {
		expect(lookupUkuleleChord("H")).toBeNull();
		expect(lookupUkuleleChord("Cweird")).toBeNull();
	});
});

describe("parseCustomChordDefs", () => {
	it("splits definitions by fret string length", () => {
		const defs = parseCustomChordDefs("Am[x02210]\nC[0003]\nG[0232]\nx[1]");
		expect([...defs.guitar.keys()]).toEqual(["Am"]);
		expect([...defs.ukulele.keys()]).toEqual(["C", "G"]);
		expect(defs.ukulele.get("G")?.fingers).toEqual([
			[4, 0],
			[3, 2],
			[2, 3],
			[1, 2],
		]);
	});
});
