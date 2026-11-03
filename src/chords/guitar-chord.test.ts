import { describe, expect, it } from "@jest/globals";
import {
	lookupChord,
	lookupFrettedChord,
	lookupUkuleleChord,
	isFretString,
	parseCustomChordDefs,
	parseFretString,
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

	it("reads listed fret strings with two-digit frets from their position", () => {
		const defs = parseCustomChordDefs("G7[x,10,9,10,8,x]\nC[8, 10, 10, 9, 8, 8]");
		const g7 = defs.guitar.get("G7");
		expect(g7?.position).toBe(8);
		expect(g7?.fingers).toEqual([
			[6, "x"],
			[5, 3],
			[4, 2],
			[3, 3],
			[2, 1],
			[1, "x"],
		]);
		const c = defs.guitar.get("C");
		expect(c?.position).toBe(8);
		expect(c?.fingers.map(([, fret]) => fret)).toEqual([1, 3, 3, 2, 1, 1]);
	});

	it("shifts compact voicings past the diagram window too", () => {
		const defs = parseCustomChordDefs("G[355433]\nAm[x02210]\nD[2,2,2,5]");
		expect(defs.guitar.get("G")?.position).toBe(3);
		expect(defs.guitar.get("G")?.fingers.map(([, f]) => f)).toEqual([
			1, 3, 3, 2, 1, 1,
		]);
		expect(defs.guitar.get("Am")?.position).toBeUndefined();
		expect(defs.ukulele.get("D")?.position).toBe(2);
		expect(defs.ukulele.get("D")?.fingers.map(([, f]) => f)).toEqual([
			1, 1, 1, 4,
		]);
	});

	it("ignores listed fret strings of unknown string counts", () => {
		const defs = parseCustomChordDefs("G7[x,10,9,10,8]\nA[1,2,3,4,5,6,7]");
		expect(defs.guitar.size).toBe(0);
		expect(defs.ukulele.size).toBe(0);
	});
});

describe("parseFretString", () => {
	it("returns frets low string first with -1 for muted strings", () => {
		expect(parseFretString("x02210")).toEqual([-1, 0, 2, 2, 1, 0]);
		expect(parseFretString("x,10,9,10,8,X")).toEqual([-1, 10, 9, 10, 8, -1]);
		expect(parseFretString(" 0003 ")).toEqual([0, 0, 0, 3]);
	});

	it("rejects other bracket contents", () => {
		expect(parseFretString("Verse 1")).toBeNull();
		expect(parseFretString("Am")).toBeNull();
		expect(parseFretString("x0221")).toBeNull();
		expect(parseFretString("10,9,10")).toBeNull();
		expect(parseFretString("x,,10,9,10,8")).toBeNull();
	});
});

describe("isFretString", () => {
	it("recognises both forms regardless of length", () => {
		expect(isFretString("x02210")).toBe(true);
		expect(isFretString("x,10,9,10,8,x")).toBe(true);
		expect(isFretString("123")).toBe(true);
		expect(isFretString("Am")).toBe(false);
		expect(isFretString("Verse 1")).toBe(false);
	});
});
