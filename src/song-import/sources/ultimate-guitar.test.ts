import { describe, expect, it } from "@jest/globals";
import { findSource } from "../sources";
import {
	extractUgPage,
	isUgUrl,
	parseApplicature,
	parseStrummings,
	ultimateGuitarSource,
} from "./ultimate-guitar";

function encodeAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function pageHtml(store: unknown, swapAttributes = false): string {
	const attr = `data-content="${encodeAttr(JSON.stringify(store))}"`;
	const div = swapAttributes
		? `<div ${attr} class="js-store">`
		: `<div class="js-store" ${attr}>`;
	return `<html><body><div class="other"></div>${div}</div></body></html>`;
}

const CONTENT =
	"[tab][ch]C[/ch]               [ch]G[/ch]\r\nWhen I find myself in times[/tab]";

function ugStore(tabOverrides: Record<string, unknown> = {}): unknown {
	return {
		store: {
			page: {
				data: {
					tab: {
						song_name: "Let It Be",
						artist_name: "The Beatles",
						type: "Chords",
						tonality_name: "C",
						...tabOverrides,
					},
					tab_view: {
						meta: {
							capo: 2,
							tuning: { name: "Standard", value: "E A D G B E" },
						},
						wiki_tab: { content: CONTENT },
						strummings: [
							{
								part: "Verse",
								denuminator: 8,
								bpm: 96,
								is_main: 1,
								measures: [1, 101, 1, 101, 1, 101, 1, 101].map(
									(measure) => ({ measure }),
								),
							},
						],
						applicature: {
							C: [{ id: 1, listCapos: [{ startFret: 0, finger: [0, 3, 2, 0, 1, 0], listNotes: [-1, 3, 2, 0, 1, 0] }] }],
							G: [{ id: 2, frets: [3, 2, 0, 0, 0, 3] }],
						},
					},
				},
			},
		},
	};
}

describe("extractUgPage", () => {
	const url = "https://tabs.ultimate-guitar.com/tab/the-beatles/let-it-be-chords-17427";

	it("reads title, artist, key, capo, tuning, sheet, strummings and voicings", () => {
		const result = extractUgPage(pageHtml(ugStore()), url);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.song).toEqual({
			title: "Let It Be",
			artist: "The Beatles",
			sheet: CONTENT,
			source: "ultimate-guitar",
			url,
			key: "C",
			capo: 2,
			tuning: "Standard",
			strummings: [
				{
					part: "Verse",
					bpm: 96,
					denominator: 8,
					isTriplet: false,
					measures: [1, 101, 1, 101, 1, 101, 1, 101],
				},
			],
			voicings: { C: "x32010", G: "320003" },
		});
	});

	it("accepts data-content before class", () => {
		expect(extractUgPage(pageHtml(ugStore(), true)).ok).toBe(true);
	});

	it("reports a missing store", () => {
		expect(extractUgPage("<html><body>nope</body></html>")).toEqual({
			ok: false,
			message: "Could not find tab content on that page (see the developer console).",
			debug: { reason: "no-store", keys: [] },
		});
	});

	it("reports invalid JSON", () => {
		const html = `<div class="js-store" data-content="{&quot;store&quot;:">`;
		const result = extractUgPage(html);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.debug).toEqual({ reason: "bad-json", keys: [] });
	});

	it("reports missing content with the store keys", () => {
		const html = pageHtml({
			store: { page: { data: { tab: { song_name: "x" } } } },
			extra: 1,
		});
		const result = extractUgPage(html);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.debug).toEqual({
			reason: "no-content",
			keys: ["store", "extra", "store.page.data.tab"],
		});
	});

	it("finds content and song fields at other paths", () => {
		const html = pageHtml({
			store: {
				other: {
					nested: {
						tab: {
							song_name: "Song",
							artist_name: "Artist",
							type: "Ukulele Chords",
						},
						view: { wiki_tab: { content: "[ch]Am[/ch]" }, meta: { capo: 0 } },
					},
				},
			},
		});
		const result = extractUgPage(html);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.song.title).toBe("Song");
		expect(result.song.artist).toBe("Artist");
		expect(result.song.sheet).toBe("[ch]Am[/ch]");
		expect(result.song.url).toBeUndefined();
		expect(result.song.capo).toBeUndefined();
		expect(result.song.strummings).toBeUndefined();
		expect(result.song.voicings).toBeUndefined();
	});

	it("decodes entities inside the content", () => {
		const result = extractUgPage(
			pageHtml(ugStore()).replace("[tab]", "[tab]&amp;nbsp;"),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.song.sheet.startsWith("[tab] ")).toBe(true);
	});

	it("refuses pages that are not chord pages", () => {
		expect(extractUgPage(pageHtml(ugStore({ type: "Tab" })))).toEqual({
			ok: false,
			message: 'Only chord pages can be imported; this page is of type "Tab".',
		});
	});

	it("is registered as a source matched by its links", () => {
		expect(findSource(url)).toBe(ultimateGuitarSource);
		expect(findSource("https://example.com/x")).toBeUndefined();
		expect(ultimateGuitarSource.frontmatterKey).toBe("ultimateguitar");
	});
});

describe("isUgUrl", () => {
	it("accepts Ultimate Guitar links", () => {
		expect(
			isUgUrl(
				"https://tabs.ultimate-guitar.com/tab/the-beatles/let-it-be-chords-17427",
			),
		).toBe(true);
		expect(isUgUrl("  https://www.ultimate-guitar.com/x  ")).toBe(true);
	});

	it("rejects other hosts and multi-line text", () => {
		expect(isUgUrl("https://example.com/tab")).toBe(false);
		expect(isUgUrl("https://tabs.ultimate-guitar.com/x\nAm C")).toBe(false);
	});
});

describe("parseStrummings", () => {
	it("maps Ultimate Guitar patterns to the strumming block shape", () => {
		expect(
			parseStrummings([
				{
					part: "Chorus",
					denuminator: 16,
					bpm: 120,
					is_triplet: 1,
					measures: [{ measure: 1 }, { measure: 101 }, { measure: 999 }, 201],
				},
				{ denuminator: 8, measures: [] },
				{ nope: true },
				"junk",
			]),
		).toEqual([
			{
				part: "Chorus",
				bpm: 120,
				denominator: 16,
				isTriplet: true,
				measures: [1, 101, 202, 201],
			},
		]);
	});

	it("expands quarter-note patterns to eighths with sustains", () => {
		expect(parseStrummings([{ denuminator: 4, measures: [1, 2] }])).toEqual([
			{ denominator: 8, isTriplet: false, measures: [1, 203, 2, 203] },
		]);
	});

	it("returns nothing for missing data", () => {
		expect(parseStrummings(undefined)).toEqual([]);
		expect(parseStrummings({ measures: [1] })).toEqual([]);
	});
});

describe("parseApplicature", () => {
	it("reads frets regardless of string order", () => {
		expect(
			parseApplicature(
				{
					Am: [{ frets: [0, 1, 2, 2, 0, -1] }],
					C: [{ listCapos: [{ listNotes: [-1, 3, 2, 0, 1, 0] }] }],
				},
				6,
			),
		).toEqual({ Am: "x02210", C: "x32010" });
	});

	it("ignores finger arrays and voicings that do not spell the chord", () => {
		expect(
			parseApplicature(
				{
					Am: [
						{ finger: [0, 0, 2, 3, 1, 0] },
						{ frets: [-1, 3, 2, 0, 1, 0] },
						{ frets: [-1, 0, 2, 2, 1, 0] },
					],
					Hm: [{ frets: [-1, 2, 4, 4, 3, 2] }],
					E: "junk",
				},
				6,
			),
		).toEqual({ Am: "x02210" });
	});

	it("resolves relative frets with a base fret and skips frets above 9", () => {
		expect(
			parseApplicature(
				{
					"F#m": [{ startFret: 2, frets: [1, 3, 3, 1, 1, 1] }],
					Eb: [{ startFret: 11, frets: [1, 3, 3, 2, 1, 1] }],
				},
				6,
			),
		).toEqual({ "F#m": "244222" });
	});

	it("handles ukulele voicings", () => {
		expect(
			parseApplicature({ Am: [{ frets: [2, 0, 0, 0] }], C: [{ frets: [0, 0, 0, 3] }] }, 4),
		).toEqual({ Am: "2000", C: "0003" });
	});

	it("returns nothing without data", () => {
		expect(parseApplicature(undefined, 6)).toEqual({});
		expect(parseApplicature([], 6)).toEqual({});
	});
});
