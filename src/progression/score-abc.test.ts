import { describe, expect, it } from "@jest/globals";
import { parseOnly } from "abcjs";
import { parseProgression } from "./renderer-logic";
import { MEASURES_PER_LINE, abcKeyField, buildProgressionAbc, escapeLyric, voiceChord } from "./score-abc";

const abcFor = (source: string) => buildProgressionAbc(parseProgression(source)!);
const line = (abc: string, prefix: string) => abc.split("\n").find((l) => l.startsWith(prefix)) ?? "";
const trebleLine = (abc: string) => abc.split("\n")[abc.split("\n").indexOf("V:1 clef=treble") + 1] ?? "";
const bassLine = (abc: string) => abc.split("\n")[abc.split("\n").indexOf("V:2 clef=bass") + 1] ?? "";

describe("buildProgressionAbc — header", () => {
	it("writes a grand staff with the key signature", () => {
		const abc = abcFor("G\nI IV V");
		expect(abc).toContain("K:G\n%%staves {1 2}\nV:1 clef=treble\n");
		expect(abc).toContain("V:2 clef=bass\n");
		expect(abc).toContain("M:none");
		expect(abc).toContain("L:1/4");
		expect(abc).toContain("Q:1/4=72");
	});

	it("uses the minor key field", () => {
		expect(line(abcFor("a:\ni iv V"), "K:")).toBe("K:Am");
		expect(abcKeyField({ tonic: "F#", minor: true })).toBe("F#m");
		expect(abcKeyField({ tonic: "Bb", minor: false })).toBe("Bb");
	});
});

describe("buildProgressionAbc — voicing", () => {
	it("puts the bass between E2 and E3", () => {
		expect(voiceChord(["E", "G", "B"])?.bass).toEqual({ pitch: "E", octave: 2 });
		expect(voiceChord(["C", "E", "G"])?.bass).toEqual({ pitch: "C", octave: 3 });
		expect(voiceChord(["Eb", "G", "Bb"])?.bass).toEqual({ pitch: "Eb", octave: 3 });
	});

	it("stacks the upper voices in close position from octave 4 and doubles the bass of a triad", () => {
		expect(voiceChord(["C", "E", "G"])?.treble).toEqual([
			{ pitch: "E", octave: 4 },
			{ pitch: "G", octave: 4 },
			{ pitch: "C", octave: 5 },
		]);
		expect(voiceChord(["E", "G", "C"])?.treble).toEqual([
			{ pitch: "G", octave: 4 },
			{ pitch: "C", octave: 5 },
			{ pitch: "E", octave: 5 },
		]);
	});

	it("does not double the bass of a seventh chord", () => {
		expect(voiceChord(["G", "B", "D", "F"])?.treble.map((n) => n.pitch)).toEqual(["B", "D", "F"]);
	});

	it("renders octaves with ABC commas and lowercase letters", () => {
		const abc = abcFor("C\nI");
		expect(trebleLine(abc)).toBe("[EGc] |]");
		expect(bassLine(abc)).toBe("C, |]");
	});
});

describe("buildProgressionAbc — accidentals", () => {
	it("omits accidentals that are in the key signature", () => {
		const abc = abcFor("G\nV");
		expect(trebleLine(abc)).toBe("[FAd] |]");
	});

	it("writes naturals that contradict the key signature", () => {
		// bVII in G is F major: F natural needs "=", the bass F too
		const abc = abcFor("G\nbVII");
		expect(trebleLine(abc)).toBe("[Ac=f] |]");
		expect(bassLine(abc)).toBe("=F,, |]");
	});

	it("writes chromatic accidentals in a natural key", () => {
		expect(trebleLine(abcFor("C\nbVI"))).toBe("[C_E_A] |]");
		expect(trebleLine(abcFor("C\nIII+"))).toBe("[^G^Be] |]");
	});

	it("restores a natural after a chromatic note in the same measure", () => {
		// bVI (Ab) then IV (F A C): the A in the same octave needs a natural
		const abc = abcFor("C\nbVI IV");
		expect(trebleLine(abc)).toBe("[C_E_A] [=Acf] |]");
	});

	it("resets accidentals at a bar line", () => {
		const abc = abcFor("C\nbVI\nIV");
		expect(trebleLine(abc)).toBe("[C_E_A] | [Acf] |]");
	});
});

describe("buildProgressionAbc — rows, keys and rests", () => {
	it("makes one measure per row", () => {
		const abc = abcFor("C\nI IV\nV I");
		expect(trebleLine(abc)).toBe("[EGc] [Acf] | [Bdg] [EGc] |]");
		expect(bassLine(abc)).toBe("C, F,, | G,, C, |]");
	});

	it("emits an inline key change in both voices and switches the signature", () => {
		const abc = abcFor("C\nI G: V I");
		expect(trebleLine(abc)).toBe("[EGc] [K:G] [FAd] [Bdg] |]");
		expect(bassLine(abc)).toBe("C, [K:G] D, G,, |]");
	});

	it("renders NC and unresolved tokens as annotated rests without lyrics", () => {
		const abc = abcFor("C\nI NC xyz V");
		expect(trebleLine(abc)).toBe('[EGc] "^NC"z "^?"z [Bdg] |]');
		expect(bassLine(abc)).toBe("C, z z G,, |]");
		expect(line(abc, "w:")).toBe("w: I V");
	});

	it("writes one lyric syllable per chord with escaping", () => {
		expect(line(abcFor("C\nI vii°6 V7/IV V65[no5]"), "w:")).toBe("w: I vii°6 V7/IV V65[no5]");
		expect(escapeLyric("a-b_c d*e~f|g")).toBe("a\\-b\\_c~d\\*e\\~f\\|g");
	});
});

describe("buildProgressionAbc — abcjs round trip", () => {
	it("parses without warnings and keeps one treble chord per item", () => {
		const source = [
			"G",
			"m0 b3 G: I",
			"m1 b2 IV6 b3 V6",
			"m3 IV b2.5 viio6 b3 I",
			"m6 I b2 Ger65 b3 Cad64 b4 V",
			"m7 bVI b2 V65[no5][b3]",
			"m8 vi C: ii",
		].join("\n");
		const model = parseProgression(source)!;
		const tune = parseOnly(buildProgressionAbc(model))[0];
		expect(tune).toBeDefined();
		if (!tune) return;
		expect(tune.warnings).toBeUndefined();

		const items = model.rows.flat();
		const trebleVoice = tune.lines.flatMap((l) => l.staff?.[0]?.voices?.[0] ?? []);
		const notes = trebleVoice.filter((e) => e.el_type === "note" && !(e as { rest?: unknown }).rest);
		expect(notes).toHaveLength(items.length);
		const syllables = notes.flatMap((n) => {
			const lyric = (n as { lyric?: { syllable: string }[] }).lyric ?? [];
			return lyric.map((l) => l.syllable);
		});
		expect(syllables).toEqual(items.map((i) => i.numeral));
		expect(tune.getBpm()).toBe(72);
	});
});

describe("buildProgressionAbc — metered blocks", () => {
	it("writes the meter, sixteenth-note base and real durations", () => {
		const abc = abcFor("C\nTime Signature: 4/4\nm1 I b3 V\nm2 b2 IV b2.5 V b3 I");
		expect(line(abc, "M:")).toBe("M:4/4");
		expect(line(abc, "L:")).toBe("L:1/16");
		expect(trebleLine(abc)).toBe("[EGc]8 [Bdg]8 | z4 [Acf]2 [Bdg]2 [EGc]8 |]");
		expect(bassLine(abc)).toBe("C,8 G,,8 | z4 F,,2 G,,2 C,8 |]");
	});

	it("gives unmarked rows one beat per chord inside a metered block", () => {
		expect(trebleLine(abcFor("C\nTime Signature: 3/4\nI IV V\nm2 I b3 V"))).toBe("[EGc]4 [Acf]4 [Bdg]4 | [EGc]8 [Bdg]4 |]");
	});

	it("handles a pickup measure and compound meter", () => {
		expect(trebleLine(abcFor("G\nTime Signature: 3/4\nm0 b3 I"))).toBe("z8 [Bdg]4 |]");
		expect(trebleLine(abcFor("C\nTime Signature: 6/8\nm1 I b4 V"))).toBe("[EGc]6 [Bdg]6 |]");
	});

	it("emits an inline meter change", () => {
		const abc = abcFor("C\nTime Signature: 4/4\nm1 I\nTime Signature: 3/4\nm2 V");
		expect(trebleLine(abc)).toBe("[EGc]16 | [M:3/4] [Bdg]12 |]");
	});

	it("still parses in abcjs with the right bar lengths", () => {
		const model = parseProgression("G\nTime Signature: 3/4\nm0 b3 G: I\nm1 b2 IV6 b3 V6\nm3 IV b2.5 viio6 b3 I")!;
		const tune = parseOnly(buildProgressionAbc(model))[0];
		expect(tune?.warnings).toBeUndefined();
	});
});

describe("buildProgressionAbc — systems", () => {
	it("breaks into systems of four measures with both voices and lyrics per system", () => {
		const rows = Array.from({ length: 6 }, (_, i) => `m${i + 1} I V`).join("\n");
		const abc = abcFor(`C\n${rows}`);
		const lines = abc.split("\n");
		expect(MEASURES_PER_LINE).toBe(4);
		expect(lines.filter((l) => l === "V:1 clef=treble" || l === "V:1")).toHaveLength(2);
		expect(lines.filter((l) => l.startsWith("w: "))).toEqual(["w: I V I V I V I V", "w: I V I V"]);
		expect(lines[lines.indexOf("V:1 clef=treble") + 1]?.endsWith(" |")).toBe(true);
		expect(lines[lines.indexOf("V:1") + 1]?.endsWith(" |]")).toBe(true);
		const tune = parseOnly(abc)[0];
		expect(tune?.warnings).toBeUndefined();
		expect(tune?.lines.filter((l) => l.staff).length).toBe(2);
	});
});

describe("buildProgressionAbc — pivot chords", () => {
	it("plays the pivot once, labels it with both readings and changes key after it", () => {
		const abc = abcFor("F\nI vi C: ii V I");
		expect(trebleLine(abc)).toBe("[Acf] [FAd] [K:C] [Bdg] [EGc] |]");
		expect(line(abc, "w:")).toBe("w: I vi~=~C:~ii V I");
	});
});
