import { describe, expect, it } from "@jest/globals";
import { highlightProgressionLine, progressionBodyRanges, progressionHighlights } from "./editor-highlight-logic";

const classesOf = (text: string, key = "C") => {
	const state = { key: null as ReturnType<typeof import("./roman").parseKey> };
	highlightProgressionLine(key, state, true);
	return highlightProgressionLine(text, state).map((s) => `${text.slice(s.from, s.to)}:${s.cls}`);
};

describe("progressionBodyRanges", () => {
	it("finds progression blocks only", () => {
		expect(progressionBodyRanges(["```progression", "C", "I IV", "```", "```chords", "[C]", "```"])).toEqual([[1, 2]]);
	});
});

describe("highlightProgressionLine", () => {
	it("marks the key line", () => {
		const state = { key: null };
		expect(highlightProgressionLine("  Am", state, true)).toEqual([{ from: 2, to: 4, cls: "key" }]);
		expect(state.key).toEqual({ tonic: "A", minor: true });
	});

	it("finds the key line behind metadata and comments", () => {
		const lines = ["```progression", "# intro", "Composer: X", "Am", "I iv", "```"];
		const out = progressionHighlights(lines, 1, 4);
		expect(out.map((l) => l.spans.map((s) => s.cls))).toEqual([["comment"], ["meta"], ["key"], ["tonic", "predominant"]]);
	});

	it("colours numerals by harmonic function", () => {
		expect(classesOf("I ii V7 vi V/V bVII")).toEqual([
			"I:tonic",
			"ii:predominant",
			"V7:dominant",
			"vi:tonic",
			"V/V:applied",
			"bVII:chromatic",
		]);
	});

	it("marks chord names, keys, markers and comments", () => {
		expect(classesOf("m1 b2 Dm G: V || NC  # a note")).toEqual([
			"m1:marker",
			"b2:marker",
			"Dm:chord",
			"G::key",
			"V:dominant",
			"||:marker",
			"NC:marker",
			"# a note:comment",
		]);
	});

	it("dims metadata and repeat lines", () => {
		expect(classesOf("Composer: Bach")).toEqual(["Composer: Bach:meta"]);
		expect(classesOf("m9-10 = m1-2")).toEqual(["m9-10 = m1-2:marker"]);
	});

	it("leaves unknown tokens unmarked", () => {
		expect(classesOf("I xyz")).toEqual(["I:tonic"]);
	});
});

describe("progressionHighlights", () => {
	it("keeps the key context when only later lines are visible", () => {
		const lines = ["```progression", "G", "I IV", "m2 C: ii V", "vi", "```"];
		const out = progressionHighlights(lines, 4, 4);
		expect(out).toEqual([{ line: 4, spans: [{ from: 0, to: 2, cls: "tonic" }] }]);
	});
});
