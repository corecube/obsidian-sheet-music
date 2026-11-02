import { describe, expect, it } from "@jest/globals";
import {
	convertChordSheet,
	dropRepeatedChords,
	isChordToken,
} from "./chord-sheet";

describe("isChordToken", () => {
	it.each([
		"Am",
		"C",
		"G",
		"Bb",
		"F#m7b5",
		"A7sus4",
		"Dsus2",
		"Cadd9",
		"G/B",
		"Am7/G",
		"Dm(maj7)",
		"E5",
		"Caug",
		"Gdim",
		"Cmaj7",
		"D/F#",
	])("accepts %s", (token) => {
		expect(isChordToken(token)).toBe(true);
	});

	it.each(["Do", "La", "H", "Hm", "a", "e", "Riff", "Intro", "N.C.", "x2"])(
		"rejects %s",
		(token) => {
			expect(isChordToken(token)).toBe(false);
		},
	);
});

describe("convertChordSheet", () => {
	it("merges a marked chord line into the lyric below at its columns", () => {
		expect(
			convertChordSheet(
				"[tab][ch]Am[/ch]              [ch]C[/ch]\nNo existe nadie como tú[/tab]",
			),
		).toEqual(["[Am]No existe nadie [C]como tú"]);
	});

	it("treats CRLF, nbsp and tabs like LF and spaces", () => {
		const lf = "[ch]Am[/ch]    [ch]C[/ch]\nla la la la";
		const crlf =
			"[ch]Am[/ch]\u00a0\u00a0\u00a0\u00a0[ch]C[/ch]\r\nla la\tla la";
		expect(convertChordSheet(crlf)).toEqual(convertChordSheet(lf));
		expect(convertChordSheet(lf)).toEqual(["[Am]la la [C]la la"]);
	});

	it("keeps a chord line standalone before a blank, a section or chords", () => {
		expect(
			convertChordSheet(
				"[ch]Am[/ch]    [ch]C[/ch]\n\n[Chorus]\n[ch]G[/ch] [ch]D[/ch]\n[ch]Em[/ch]\nlyric",
			),
		).toEqual([
			"[Am] [C]",
			"",
			"[Chorus]",
			"",
			"[G] [D]",
			"[Em]lyric",
		]);
	});

	it("pads the lyric when a chord sits beyond its end", () => {
		expect(
			convertChordSheet("[ch]C[/ch]         [ch]G[/ch]\nshort"),
		).toEqual(["[C]short [G]"]);
	});

	it("inserts chords mid-word", () => {
		expect(
			convertChordSheet("[ch]C[/ch]                  [ch]G[/ch]\n La luz de tu mirar, tu"),
		).toEqual(["[C]La luz de tu mirar[G], tu"]);
	});

	it("removes lyric indentation and alignment spacing", () => {
		expect(
			convertChordSheet(
				[
					"[ch]F[/ch]",
					"     En mi bandera llevo el alma",
					"     Amarrada por mi calma",
					"[ch]Am[/ch]",
					"(Oh uh!)   Llega el momento",
					"Oh!       Como un animal   [ch]Am[/ch]",
				].join("\n"),
			),
		).toEqual([
			"[F]En mi bandera llevo el alma",
			"Amarrada por mi calma",
			"[Am](Oh uh!) Llega el momento",
			"Oh! Como un animal [Am]",
		]);
	});

	it("splits a header from the chords on the same line", () => {
		expect(convertChordSheet("[Intro] [ch]Am[/ch] [ch]C[/ch]")).toEqual([
			"[Intro]",
			"",
			"[Am] [C]",
		]);
	});

	it("flattens chord markers inside a section header", () => {
		expect(convertChordSheet("[Verse 1: [ch]Am[/ch]]")).toEqual([
			"[Verse 1: Am]",
		]);
	});

	it("leaves tablature untouched and never merges into it", () => {
		const staff = [
			"e|--0---3---|",
			"B|--1---0---|",
			"G|--0---0---|",
			"D|--2---0---|",
			"A|--3-------|",
			"E|------3---|",
		];
		const input = ["[ch]C[/ch]   [ch]G[/ch]", ...staff].join("\n");
		expect(convertChordSheet(input)).toEqual(["[C] [G]", ...staff]);
	});

	it("merges bare pasted chords over lyrics", () => {
		expect(convertChordSheet("Am        C\nNo existe nadie")).toEqual([
			"[Am]No existe [C]nadie",
		]);
	});

	it("does not treat bare words as chords when markers are present", () => {
		expect(convertChordSheet("[ch]Am[/ch]\nA\nla")).toEqual(["[Am]A", "la"]);
	});

	it("brackets slash and extended chords", () => {
		expect(
			convertChordSheet("G/B A7sus4    Cadd9\none two three four"),
		).toEqual(["[G/B]one [A7sus4]two three [Cadd9]four"]);
	});

	it("keeps annotations unbracketed", () => {
		expect(convertChordSheet("[ch]Am[/ch]   [ch]C[/ch] (x2)")).toEqual([
			"[Am] [C] (x2)",
		]);
		expect(convertChordSheet("N.C. [ch]G[/ch]\nla la la")).toEqual([
			"N.C.la la[G] la",
		]);
	});

	it("brackets chord markers inside a lyric line in place", () => {
		expect(convertChordSheet("Some [ch]Am[/ch] text")).toEqual([
			"Some [Am] text",
		]);
	});

	it("removes tab markers around lyric-only lines", () => {
		expect(convertChordSheet("[tab]one\ntwo[/tab]")).toEqual(["one", "two"]);
	});

	it("keeps blank lines only around section headers", () => {
		expect(convertChordSheet("\n\n[Verse]\n\n\n\nla\n\n")).toEqual([
			"[Verse]",
			"",
			"la",
		]);
		expect(
			convertChordSheet(
				"\n[Verse 1]\n[ch]Am[/ch]\nEmpieza\n\nNoble\n[ch]Dm[/ch]\nHoy\n\n[Pre-chorus]\n[ch]F[/ch]\nOh\n\n[ch]C[/ch]\nEn mi\n",
			),
		).toEqual([
			"[Verse 1]",
			"",
			"[Am]Empieza",
			"Noble",
			"[Dm]Hoy",
			"",
			"[Pre-chorus]",
			"",
			"[F]Oh",
			"[C]En mi",
		]);
	});

	it("converts the README example", () => {
		expect(convertChordSheet("[Verse 1]\nC                  G\n La luz de tu mirar, tu hermoso caminar\nAm                    C\n No existe nadie como tú")).toEqual(["[Verse 1]", "", "[C]La luz de tu mirar[G], tu hermoso caminar", "[Am]No existe nadie como [C]tú"]);
	});

	it("puts a lyric line's header on its own line", () => {
		expect(convertChordSheet("[Chorus] la la")).toEqual([
			"[Chorus]",
			"",
			"la la",
		]);
	});
});

describe("dropRepeatedChords", () => {
	it("removes markers that repeat the chord in effect, across lines", () => {
		expect(
			dropRepeatedChords([
				"[Verse]",
				"[C]When I find my[C]self in [G]times",
				"[G]of trouble [C]la",
				"[C]Mother [Am]Mary",
			]),
		).toEqual([
			"[Verse]",
			"[C]When I find myself in [G]times",
			"of trouble [C]la",
			"Mother [Am]Mary",
		]);
	});

	it("starts over at section headers", () => {
		expect(dropRepeatedChords(["[C]la", "[Chorus]", "[C]la"])).toEqual([
			"[C]la",
			"[Chorus]",
			"[C]la",
		]);
	});

	it("drops lines left empty and trims standalone chord lines", () => {
		expect(dropRepeatedChords(["[C]    [C]", "[C]", "[G] [C]"])).toEqual([
			"[C]",
			"[G] [C]",
		]);
	});

	it("keeps lines without brackets untouched", () => {
		expect(dropRepeatedChords(["la  ", ""])).toEqual(["la  ", ""]);
	});
});
