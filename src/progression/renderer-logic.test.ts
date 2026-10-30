import { describe, expect, it } from "@jest/globals";
import { beatGrid, beatSubdivision, chordDurations, clampBeats, parseProgression } from "./renderer-logic";

const row = (source: string, index = 0) => parseProgression(source)?.rows[index];
const chords = (source: string, index = 0) => row(source, index)?.map((i) => i.chord);
const numerals = (source: string, index = 0) => row(source, index)?.map((i) => i.numeral);

describe("parseProgression — structure", () => {
	it("parses key from first line", () => {
		const model = parseProgression("C\nI ii V7 I");
		expect(model?.key).toBe("C");
		expect(model?.rows).toHaveLength(1);
		expect(model?.rows[0]).toMatchObject([
			{ numeral: "I", chord: "C" },
			{ numeral: "ii", chord: "Dm" },
			{ numeral: "V7", chord: "G7" },
			{ numeral: "I", chord: "C" },
		]);
	});

	it("accepts RomanText key spellings", () => {
		expect(chords("C:\nI")).toEqual(["C"]);
		expect(chords("c:\ni")).toEqual(["Cm"]);
		expect(chords("f#:\nV")).toEqual(["C#"]);
		expect(chords("B-:\nI")).toEqual(["Bb"]);
	});

	it("parses multiple rows", () => {
		const model = parseProgression("C\nI vi\nIV V");
		expect(model?.rows).toHaveLength(2);
		expect(model?.rows[0]?.[0]?.chord).toBe("C");
		expect(model?.rows[1]?.[1]?.chord).toBe("G");
	});

	it("returns null when no key is given before the first chord", () => {
		expect(parseProgression("I ii V7 I")).toBeNull();
		expect(parseProgression("I G: ii")).toBeNull();
	});

	it("takes the key from the first inline token when there is no key line", () => {
		const model = parseProgression("Composer: J. S. Bach\nm0 b3 G: I\nm1 IV V");
		expect(model?.key).toBe("G:");
		expect(model?.initialKey).toEqual({ tonic: "G", minor: false });
		expect(model?.rows[0]?.[0]).toMatchObject({ numeral: "I", chord: "G" });
		expect(model?.rows[0]?.[0]?.keyChange).toBeUndefined();
		expect(chords("m0 b3 a: i\nm1 iv V")).toEqual(["Am"]);
	});

	it("strips # comments but keeps # accidentals", () => {
		expect(chords("C\nI IV # a comment with #iv in it")).toEqual(["C", "F"]);
		expect(chords("C\n#ivo7 V # comment")).toEqual(["F#dim7", "G"]);
		expect(chords("C\nI #ivo7")).toEqual(["C", "F#dim7"]);
		expect(parseProgression("# only a comment\nC\nI")?.rows).toHaveLength(1);
	});

	it("returns null for empty source", () => {
		expect(parseProgression("")).toBeNull();
		expect(parseProgression("C")).toBeNull();
	});

	it("marks unrecognised tokens with ?", () => {
		expect(row("C\nI xyz V")?.[1]).toMatchObject({ numeral: "xyz", chord: "?" });
	});
});

describe("parseProgression — RomanText chord grammar", () => {
	it("uses case for triad quality", () => {
		expect(chords("C\nI ii iii IV V vi")).toEqual(["C", "Dm", "Em", "F", "G", "Am"]);
	});

	it("handles diminished, half-diminished and augmented suffixes", () => {
		expect(chords("C\nviio viio7 viiø7 vii/o7 III+")).toEqual(["Bdim", "Bdim7", "Bm7b5", "Bm7b5", "E+"]);
		expect(numerals("C\nviio vii/o7")).toEqual(["vii°", "viiø7"]);
	});

	it("handles root accidentals", () => {
		expect(chords("C\nbVII bVI #ivo bII")).toEqual(["Bb", "Ab", "F#dim", "Db"]);
	});

	it("handles triad inversions", () => {
		expect(chords("C\nI6 I64 I6/4 ii6")).toEqual(["C/E", "C/G", "C/G", "Dm/F"]);
	});

	it("handles seventh chords and their inversions", () => {
		expect(chords("C\nV7 V65 V43 V42 V2 V6/5")).toEqual(["G7", "G7/B", "G7/D", "G7/F", "G7/F", "G7/B"]);
	});

	it("builds diatonic sevenths", () => {
		expect(chords("C\nI7 ii7 IV7 vi7 bVI7")).toEqual(["Cmaj7", "Dm7", "Fmaj7", "Am7", "Abmaj7"]);
	});

	it("handles ninths and altered extensions", () => {
		expect(chords("C\nV9 V7[b9]")).toEqual(["G9", "G7(b9)"]);
	});

	it("handles applied chords, including chains", () => {
		expect(chords("C\nV/V V7/IV V/ii V7/V/V")).toEqual(["D", "C7", "A", "A7"]);
	});

	it("handles Neapolitan, augmented sixth and cadential abbreviations", () => {
		expect(chords("C\nN6 N It6 Ger65 Fr43 Cad64")).toEqual([
			"Db/F",
			"Db",
			"Ab C F#",
			"Ab C Eb F#",
			"Ab C D F#",
			"C/G",
		]);
		expect(numerals("C\nN6 Ger65 Cad64")).toEqual(["N6", "Ger65", "Cad64"]);
	});

	it("handles bracketed alterations", () => {
		expect(chords("C\nV7[no5] I[add9] V65[no5][add#6][b3]")).toEqual(["G7(no5)", "Cadd9", "Gm7add#6(no5)/Bb"]);
	});

	it("renders no chord", () => {
		expect(row("C\nI NC V")?.[1]).toMatchObject({ numeral: "NC", chord: "N.C." });
	});

	it("falls back to tonal for shapes outside the grammar", () => {
		expect(row("C\nIVsus4")?.[0]).toMatchObject({ numeral: "IVsus4", chord: "Fsus4" });
	});
});

describe("parseProgression — minor keys", () => {
	it("uses natural minor degrees by default", () => {
		expect(chords("Am\ni iv V VII VI III")).toEqual(["Am", "Dm", "E", "G", "F", "C"]);
	});

	it("raises degrees 6 and 7 for minor and diminished chords", () => {
		expect(chords("a:\nviio viio7 vio ii iio iiø7")).toEqual(["G#dim", "G#dim7", "F#dim", "Bm", "Bdim", "Bm7b5"]);
	});

	it("builds the dominant and tonic sevenths", () => {
		expect(chords("a:\nV7 i7")).toEqual(["E7", "Am7"]);
	});

	it("resolves abbreviations in minor", () => {
		expect(chords("a:\nCad64 Ger65")).toEqual(["Am/E", "F A C D#"]);
	});

	it("still accepts the legacy tonal-style spelling", () => {
		expect(parseProgression("Am\nIm IVm V")?.rows[0]).toMatchObject([
			{ numeral: "i", chord: "Am" },
			{ numeral: "iv", chord: "Dm" },
			{ numeral: "V", chord: "E" },
		]);
	});
});

describe("parseProgression — legacy tonal spellings", () => {
	it("normalises IIm, VIm, IVmaj7, VIIdim to RomanText", () => {
		expect(parseProgression("C\nI IIm V7 IVmaj7 VIIdim")?.rows[0]).toMatchObject([
			{ numeral: "I", chord: "C" },
			{ numeral: "ii", chord: "Dm" },
			{ numeral: "V7", chord: "G7" },
			{ numeral: "IV7", chord: "Fmaj7" },
			{ numeral: "vii°", chord: "Bdim" },
		]);
	});
});

describe("parseProgression — inline key changes", () => {
	it("switches key mid-row and marks the first chord after the change", () => {
		const items = row("C\nI IV G: V I");
		expect(items).toMatchObject([
			{ numeral: "I", chord: "C" },
			{ numeral: "IV", chord: "F" },
			{ numeral: "V", chord: "D", keyChange: "G:" },
			{ numeral: "I", chord: "G" },
		]);
	});

	it("keeps the new key on following rows", () => {
		expect(chords("C\nI G: I\nV", 1)).toEqual(["D"]);
	});

	it("supports minor key changes", () => {
		expect(row("C\nI a: V")?.[1]).toMatchObject({ numeral: "V", chord: "E", keyChange: "a:" });
	});
});

describe("parseProgression — RomanText measure lines", () => {
	it("ignores measure and beat markers, phrase marks and metadata", () => {
		const source = [
			"G",
			"Composer: J. S. Bach",
			"Time Signature: 3/4",
			"m0 b3 G: I",
			"m1 b2 IV6 b3 V6",
			"m4 V || b3 I",
			"m9-10 = m1-2",
			"Note: consecutive first inversions",
			"m11var1 ii",
		].join("\n");
		const model = parseProgression(source);
		expect(model?.rows.map((r) => r.map((i) => i.chord))).toEqual([
			["G"],
			["C/E", "D/F#"],
			["D", "G"],
			["C/E", "D/F#"],
			["Am"],
		]);
		expect(model?.rowLabels).toEqual(["0", "1", "4", "9", "11var1"]);
	});

	it("expands repeat lines into copies of the earlier measures", () => {
		const model = parseProgression("C\nm1 I IV\nm2 V I\nm3-4 = m1-2\nm5 = m2");
		expect(model?.rowLabels).toEqual(["1", "2", "3", "4", "5"]);
		expect(model?.rows.map((r) => r.map((i) => i.chord))).toEqual([
			["C", "F"],
			["G", "C"],
			["C", "F"],
			["G", "C"],
			["G", "C"],
		]);
	});

	it("skips repeats of measures that do not exist", () => {
		expect(parseProgression("C\nm1 I\nm3-4 = m7-8")?.rowLabels).toEqual(["1"]);
	});

	it("drops a leading key token that repeats the block key", () => {
		expect(row("G\nm0 b3 G: I")?.[0]?.keyChange).toBeUndefined();
		expect(row("G\nm0 b3 C: I")?.[0]?.keyChange).toBe("C:");
	});

	it("labels rows without a measure token as null", () => {
		expect(parseProgression("C\nI IV\nm5 V I")?.rowLabels).toEqual([null, "5"]);
	});

	it("merges a pivot chord into one item carrying both readings", () => {
		const items = row("F\nvi C: ii V I");
		expect(items).toHaveLength(3);
		expect(items?.[0]).toMatchObject({
			numeral: "vi",
			chord: "Dm",
			fn: "tonic",
			pivot: { numeral: "ii", key: "C:", fn: "predominant" },
		});
		expect(items?.[1]).toMatchObject({ numeral: "V", chord: "G" });
		expect(items?.[1]?.keyChange).toBeUndefined();
	});

	it("keeps a key change between different chords as two items", () => {
		const items = row("G\nvi C: ii");
		expect(items).toHaveLength(2);
		expect(items?.[1]).toMatchObject({ numeral: "ii", chord: "Dm", keyChange: "C:" });
		expect(items?.[0]?.pivot).toBeUndefined();
	});

	it("recognises a pivot spelled differently in the two keys", () => {
		expect(row("Gb\niii F#: iii")?.[0]).toMatchObject({ chord: "Bbm", pivot: { numeral: "iii", key: "F#:" } });
	});

	it("does not pivot across a beat marker", () => {
		expect(row("F\nm1 vi C: b3 ii")).toHaveLength(2);
	});
});

describe("parseProgression — chord name input", () => {
	it("resolves chord names to RomanText numerals", () => {
		expect(parseProgression("C\nC Dm G7 C")?.rows[0]).toMatchObject([
			{ numeral: "I", chord: "C" },
			{ numeral: "ii", chord: "Dm" },
			{ numeral: "V7", chord: "G7" },
			{ numeral: "I", chord: "C" },
		]);
	});

	it("names inversions with figures", () => {
		expect(numerals("C\nC/E C/G G7/B G7/D G7/F")).toEqual(["I6", "I64", "V65", "V43", "V42"]);
	});

	it("names qualities with case and suffixes", () => {
		expect(numerals("C\nBdim Bm7b5 Bdim7 E+ Cmaj7 Am7")).toEqual(["vii°", "viiø7", "vii°7", "III+", "I7", "vi7"]);
	});

	it("marks chromatic roots and non-diatonic sevenths", () => {
		expect(numerals("C\nBb Abmaj7 F#dim7 C7 E7")).toEqual(["bVII", "bVI7", "#iv°7", "I7[b7]", "III7"]);
	});

	it("handles a lowered tonic spelled against the key", () => {
		expect(numerals("E\nEbm7 Abm7")).toEqual(["bi7[bb7]", "biv7[bb7]"]);
	});

	it("works with minor key chord input", () => {
		expect(numerals("Am\nAm Dm E G G#dim F F#dim Bm7b5")).toEqual(["i", "iv", "V", "VII", "vii°", "VI", "vi°", "iiø7"]);
	});

	it("mixes chord names and numerals in one row", () => {
		expect(chords("C\nI Am F V")).toEqual(["C", "Am", "F", "G"]);
		expect(numerals("C\nI Am F V")).toEqual(["I", "vi", "IV", "V"]);
	});

	it("does not confuse abbreviations with chord names", () => {
		expect(chords("C\nCad64 Ger65 Fr43")).toEqual(["C/G", "Ab C Eb F#", "Ab C D F#"]);
	});

	it("falls back to tonal for extended chords", () => {
		expect(numerals("C\nCsus4 C9")).toEqual(["Isus4", "I9"]);
	});
});

describe("parseProgression — harmonic function", () => {
	const fns = (source: string) => row(source)?.map((i) => i.fn);

	it("classifies diatonic degrees", () => {
		expect(fns("C\nI ii iii IV V vi viio")).toEqual([
			"tonic",
			"predominant",
			"tonic",
			"predominant",
			"dominant",
			"tonic",
			"dominant",
		]);
	});

	it("classifies applied, chromatic and special chords", () => {
		expect(fns("C\nV/V V7/IV bVII bVI N6 Ger65 Cad64")).toEqual([
			"applied",
			"applied",
			"chromatic",
			"chromatic",
			"predominant",
			"predominant",
			"dominant",
		]);
	});

	it("classifies chord-name input through its numeral", () => {
		expect(fns("C\nC Dm G7 Am")).toEqual(["tonic", "predominant", "dominant", "tonic"]);
	});

	it("leaves NC and unresolved tokens unclassified", () => {
		expect(fns("C\nNC xyz")).toEqual([undefined, undefined]);
	});
});

describe("parseProgression — beats and meter", () => {
	it("records beats on rows with markers and fills unmarked chords", () => {
		const model = parseProgression("C\nTime Signature: 3/4\nm1 I b2 IV b3 V\nm2 b2 ii V")!;
		expect(model.metered).toBe(true);
		expect(model.rowMeters[0]).toEqual({ beats: 3, unit: 4 });
		expect(model.rows[0]?.map((i) => i.beat)).toEqual([1, 2, 3]);
		expect(model.rows[1]?.map((i) => i.beat)).toEqual([2, 3]);
	});

	it("leaves plain rows unmetered", () => {
		const model = parseProgression("C\nI IV V I")!;
		expect(model.metered).toBe(false);
		expect(model.rows[0]?.every((i) => i.beat === undefined)).toBe(true);
		expect(model.rowMeters[0]).toEqual({ beats: 4, unit: 4 });
	});

	it("does not time label-only blocks", () => {
		const model = parseProgression("C\nm1 I V\nm2 I IV V I")!;
		expect(model.metered).toBe(false);
		expect(model.rows.flat().every((i) => i.beat === undefined)).toBe(true);
	});

	it("applies a time signature change to the following rows", () => {
		const model = parseProgression("C\nI\nTime Signature: 6/8\nI b4 V")!;
		expect(model.rowMeters).toEqual([
			{ beats: 4, unit: 4 },
			{ beats: 6, unit: 8 },
		]);
	});

	it("computes durations to the next chord and to the bar end", () => {
		const model = parseProgression("C\nTime Signature: 4/4\nm1 I b3 V\nm2 b2 IV b2.5 V b3 I")!;
		expect(chordDurations(model.rows[0]!, model.rowMeters[0]!)).toEqual([2, 2]);
		expect(chordDurations(model.rows[1]!, model.rowMeters[1]!)).toEqual([0.5, 0.5, 2]);
		expect(chordDurations(parseProgression("C\nI IV V")!.rows[0]!, { beats: 4, unit: 4 })).toEqual([1, 1, 1]);
	});

	it("picks a grid subdivision that fits the beat fractions", () => {
		expect(beatSubdivision(parseProgression("C\nm1 I b3 V")!)).toBe(1);
		expect(beatSubdivision(parseProgression("C\nm1 I b2.5 V")!)).toBe(2);
		expect(beatSubdivision(parseProgression("C\nm1 I b1.75 V")!)).toBe(4);
	});

	it("lays a row out on the beat grid with a gap before a late first chord", () => {
		const model = parseProgression("G\nTime Signature: 3/4\nm0 b3 I\nm1 IV b2.5 V b3 I")!;
		const sub = beatSubdivision(model);
		expect(sub).toBe(2);
		expect(beatGrid(model.rows[0]!, model.rowMeters[0]!, sub)).toEqual([
			{ item: null, span: 4, beat: 1 },
			{ item: model.rows[0]![0], span: 2, beat: 3 },
		]);
		expect(beatGrid(model.rows[1]!, model.rowMeters[1]!, sub).map((c) => c.span)).toEqual([3, 1, 2]);
	});
});

describe("clampBeats", () => {
	it("pulls a chord past the bar back and squeezes the one before it", () => {
		const model = parseProgression("C\nTime Signature: 3/4\nm6 I b2 Ger65 b3 Cad64 b4 V")!;
		expect(model.rows[0]?.map((i) => i.beat)).toEqual([1, 2, 3, 3.5]);
		expect(chordDurations(model.rows[0]!, model.rowMeters[0]!)).toEqual([1, 1, 0.5, 0.5]);
	});

	it("keeps chords in order with at least a quarter beat each", () => {
		const items = [{ beat: 1 }, { beat: 1 }, { beat: 9 }, { beat: 2 }].map((b) => ({ numeral: "I", chord: "C", ...b }));
		clampBeats(items, { beats: 2, unit: 4 });
		expect(items.map((i) => i.beat)).toEqual([1, 1.25, 2, 2.25]);
	});

	it("keeps triplet beats", () => {
		const model = parseProgression("C\nTime Signature: 4/4\nm1 I b1.33 IV b1.67 V b2 I")!;
		expect(model.rows[0]?.map((i) => i.beat)).toEqual([1, 1.33, 1.67, 2].map((b) => Math.round(b * 60) / 60));
		expect(beatSubdivision(model)).toBe(3);
	});

	it("leaves valid rows untouched and gives unmarked rows sequential beats", () => {
		const model = parseProgression("C\nTime Signature: 4/4\nm1 I b2.5 IV b4 V\nI IV")!;
		expect(model.rows[0]?.map((i) => i.beat)).toEqual([1, 2.5, 4]);
		expect(model.rows[1]?.map((i) => i.beat)).toEqual([1, 2]);
		expect(chordDurations(model.rows[1]!, model.rowMeters[1]!)).toEqual([1, 3]);
	});

	it("spreads more chords than beats evenly", () => {
		const model = parseProgression("C\nTime Signature: 4/4\nI IV V I vi\nm2 I")!;
		expect(model.rows[0]?.map((i) => i.beat)).toEqual([1, 1.8, 2.6, 3.4, 4.2]);
		expect(beatSubdivision(model)).toBe(5);
	});

	it("raises beats below one", () => {
		expect(parseProgression("C\nm1 b0 I b0.5 V")!.rows[0]?.map((i) => i.beat)).toEqual([1, 1.25]);
	});
});

describe("parseProgression — review fixes", () => {
	it("accepts a bare key line after metadata", () => {
		const model = parseProgression("Composer: X\nAm\ni iv V");
		expect(model?.key).toBe("Am");
		expect(model?.rows[0]?.map((i) => i.chord)).toEqual(["Am", "Dm", "E"]);
	});

	it("carries a key token at the end of a line to the next chord", () => {
		const model = parseProgression("C\nm1 I V G:\nm2 I IV")!;
		expect(model.rows[1]?.[0]).toMatchObject({ chord: "G", keyChange: "G:" });
		expect(parseProgression("C\nm1 I\nm2 G:\nm3 I")!.rows[1]?.[0]).toMatchObject({ chord: "G", keyChange: "G:" });
	});

	it("marks a repeated measure that started in another key and restores that key", () => {
		const model = parseProgression("C\nm1 I\nm2 G: V\nm3 = m1\nm4 I")!;
		expect(model.rows.map((r) => r.map((i) => `${i.keyChange ?? ""}${i.chord}`))).toEqual([["C"], ["G:D"], ["C:C"], ["C"]]);
	});

	it("keeps legacy major and minor sevenths", () => {
		expect(row("C\nVmaj7 IIm7 Imaj7")?.map((i) => i.chord)).toEqual(["Gmaj7", "Dm7", "Cmaj7"]);
		expect(row("C\nVmaj7 IIm7 Imaj7")?.map((i) => i.numeral)).toEqual(["V7[#7]", "ii7", "I7"]);
		expect(row("a:\nImaj7 Vmaj7 IVmaj7 Im7")?.map((i) => i.chord)).toEqual(["Amaj7", "Emaj7", "Dmaj7", "Am7"]);
	});
});
