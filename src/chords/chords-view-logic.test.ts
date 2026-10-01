import { describe, expect, it } from "@jest/globals";
import {
	chordsBlockSources,
	collectNoteChords,
	transposeNoteChords,
} from "./chords-view-logic";

const NOTE = [
	"---",
	"key: C",
	"---",
	"# Song",
	"",
	"```chords",
	"Am[x02210]",
	"[Verse 1]",
	"[C] la [G] la [Am] la",
	"> translation [D] here",
	"```",
	"",
	"```abc",
	"X:1",
	"```",
	"",
	"```chords",
	"[Chorus]",
	"[F] la [C] la",
	"```",
].join("\n");

describe("chordsBlockSources", () => {
	it("returns the content of every chords block only", () => {
		const sources = chordsBlockSources(NOTE);
		expect(sources).toHaveLength(2);
		expect(sources[0]).toContain("[Verse 1]");
		expect(sources[1]).toContain("[Chorus]");
		expect(sources.join("\n")).not.toContain("X:1");
	});

	it("returns nothing for notes without chords blocks", () => {
		expect(chordsBlockSources("# Just text\n\n```abc\nX:1\n```")).toEqual([]);
	});
});

describe("collectNoteChords", () => {
	it("collects deduplicated chord names in order of first appearance", () => {
		const { names } = collectNoteChords(NOTE);
		expect(names).toEqual(["Am", "C", "G", "F"]);
	});

	it("skips section headers, translation lines and fret strings", () => {
		const { names } = collectNoteChords(NOTE);
		expect(names).not.toContain("Verse 1");
		expect(names).not.toContain("Chorus");
		expect(names).not.toContain("D");
		expect(names).not.toContain("x02210");
	});

	it("keeps custom voicings keyed by chord name", () => {
		const { customDefs } = collectNoteChords(NOTE);
		expect([...customDefs.keys()]).toEqual(["Am"]);
	});
});

describe("transposeNoteChords", () => {
	it("transposes chords inside every chords block", () => {
		const out = transposeNoteChords(NOTE, 2);
		expect(out).toContain("[D] la [A] la [Bm] la");
		expect(out).toContain("[G] la [D] la");
	});

	it("leaves frontmatter, headings, other blocks and section headers alone", () => {
		const out = transposeNoteChords(NOTE, 2);
		expect(out).toContain("key: C");
		expect(out).toContain("# Song");
		expect(out).toContain("X:1");
		expect(out).toContain("[Verse 1]");
		expect(out).toContain("[Chorus]");
		expect(out).toContain("Am[x02210]".replace("Am", "Am"));
	});

	it("preserves line count", () => {
		expect(transposeNoteChords(NOTE, -3).split("\n")).toHaveLength(
			NOTE.split("\n").length,
		);
	});

	it("returns the input unchanged for zero semitones", () => {
		expect(transposeNoteChords(NOTE, 0)).toBe(NOTE);
	});
});
