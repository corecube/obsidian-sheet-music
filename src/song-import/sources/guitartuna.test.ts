import { describe, expect, it } from "@jest/globals";
import { convertChordSheet } from "../chord-sheet";
import { findSource } from "../sources";
import {
	extractGuitarTunaPage,
	guitarTunaSource,
	isGuitarTunaUrl,
	keyFromLabel,
	parseSchemaSong,
	parseSongPayload,
	sheetFromGuitarTunaHtml,
} from "./guitartuna";

const URL =
	"https://guitartuna.com/chords/gold-rush-ed-sheeran-original-guitar-chords-62613780062a74fec2c87d73";

function chord(name: string): string {
	return `<span><div class="beat_info" style="--w:6" data-pos="2:0.0"><div><span style="anchor-name:--anchor-0" data-chord="${name} " aria-hidden="true">${name} </span></div></div></span>`;
}
const beat = '<span><div class="beat_info" style="--w:4" data-pos="0:0.0"></div></span>';
const sr = '<span class="sr-only"> (B flat minor) </span>';

function line(chords: string[], lyric: string): string {
	return `<div class="line" data-bar="0">${chords.map(chord).join("")}${beat}<span></span><div>${lyric}</div><div></div></div>`;
}
function part(name: string): string {
	return `<div class="partContainer"><div class="part_type">${name}</div><span class="partDivider"></span></div>`;
}

const SHEET_HTML =
	'<div id="songcontent" data-testid="song-lyrics" class="lyrics-root"><a href="#songcontent-end" class="sr-only">Skip chords and lyrics</a><div>' +
	part("Intro 1") +
	line([], "All you cool people, you better leave now") +
	line(["Bbm", "Fm", "Ebm"], `${sr}${sr}${sr}`) +
	"</div><div>" +
	part("Verse 1") +
	line(["Bbm", "Fm"], `${sr}${sr}`) +
	line(["Ebm"], `Friday night and I&#x27;m ridin&#x27; solo ${sr}(yeah)`) +
	line(["Fm", "Bbm"], `${sr}I don&#x27;t mess with your energy ${sr}(no)`) +
	line(["Fm", "Ebm"], `(Don&#x27;t touch ${sr}${sr}me)`) +
	"</div></div><a id=\"songcontent-end\"></a>";

const PAYLOAD = {
	songId: "songid_1",
	capoStatus: false,
	title: "Antisocial",
	artist: "Ed Sheeran",
	videos: [{ id: "x", onsets: [1.5, 2.5] }],
	bpm: 153,
	chords: [
		{ name: "Bbm", alias: "A#m", chordData: { voicing: [-1, 2, 3, 3, 1, -1], fingering: [-1, 2, 4, 3, 1, -1] } },
		{ name: "Fm", chordData: { voicing: [1, 1, 1, 3, -1, -1] } },
		{ name: "Ebm", chordData: { voicing: [-1, 7, 8, 8, 6, -1] } },
		{ name: "Xyz", chordData: { voicing: [0, 0, 0, 0, 0, 0] } },
	],
};

function rsc(obj: unknown): string {
	const text = `72:["$","$L97",null,${JSON.stringify(obj)}]\n`;
	const half = Math.floor(text.length / 2);
	// Split across two push chunks like the real page does.
	return (
		`<script>self.__next_f.push([1,${JSON.stringify(text.slice(0, half))}])</script>` +
		`<script>self.__next_f.push([1,${JSON.stringify(text.slice(half))}])</script>`
	);
}

const SCHEMA =
	'<script type="application/ld+json">{"@context":"https://schema.org","@type":"MusicComposition","name":"Antisocial (chords)","composer":{"@type":"Person","name":"Ed Sheeran"},"musicalKey":"Bb minor","text":"Tuning: E A D G B E Key: Bb minor Tempo: 153 BPM"}</script>';
const META =
	'<div class="meta-dots" data-testid="song-meta"><a data-testid="song-meta-tuning">Tuning<!-- -->: <!-- -->E A D G B E</a><span>Difficulty: Easy</span><span>Key<!-- -->: <!-- -->Bb minor</span><span data-testid="song-meta-bpm">BPM<!-- -->: <!-- -->153</span></div>';

const PAGE = `<html><body>${SCHEMA}<main>${SHEET_HTML}${META}</main>${rsc(PAYLOAD)}</body></html>`;

describe("isGuitarTunaUrl", () => {
	it("matches chord page links", () => {
		expect(isGuitarTunaUrl(URL)).toBe(true);
		expect(isGuitarTunaUrl("https://www.guitartuna.com/chords/x-1")).toBe(true);
		expect(isGuitarTunaUrl("https://guitartuna.com/artists/ed-sheeran")).toBe(false);
		expect(isGuitarTunaUrl("https://tabs.ultimate-guitar.com/tab/x")).toBe(false);
		expect(findSource(URL)).toBe(guitarTunaSource);
	});
});

describe("keyFromLabel", () => {
	it("converts spelled-out keys", () => {
		expect(keyFromLabel("Bb minor")).toBe("Bbm");
		expect(keyFromLabel("E major")).toBe("E");
		expect(keyFromLabel("F# minor")).toBe("F#m");
		expect(keyFromLabel("nonsense")).toBeUndefined();
	});
});

describe("sheetFromGuitarTunaHtml", () => {
	it("turns sections, chord-only bars and inline chords into [ch] markup", () => {
		expect(sheetFromGuitarTunaHtml(SHEET_HTML)).toBe(
			[
				"[Intro 1]",
				"All you cool people, you better leave now",
				"[ch]Bbm[/ch] [ch]Fm[/ch] [ch]Ebm[/ch]",
				"",
				"[Verse 1]",
				"[ch]Bbm[/ch] [ch]Fm[/ch]",
				"",
				"Friday night and I'm ridin' solo [ch]Ebm[/ch](yeah)",
				"[ch]Fm[/ch]I don't mess with your energy [ch]Bbm[/ch](no)",
				"(Don't touch [ch]Fm[/ch] [ch]Ebm[/ch]me)",
			].join("\n"),
		);
	});

	it("feeds the shared converter without merging chord-only bars into lyrics", () => {
		expect(convertChordSheet(sheetFromGuitarTunaHtml(SHEET_HTML) ?? "")).toEqual([
			"[Intro 1]",
			"",
			"All you cool people, you better leave now",
			"[Bbm] [Fm] [Ebm]",
			"",
			"[Verse 1]",
			"",
			"[Bbm] [Fm]",
			"Friday night and I'm ridin' solo [Ebm](yeah)",
			"[Fm]I don't mess with your energy [Bbm](no)",
			"(Don't touch [Fm] [Ebm]me)",
		]);
	});

	it("returns null without the sheet container", () => {
		expect(sheetFromGuitarTunaHtml("<html></html>")).toBeNull();
	});
});

describe("parseSongPayload / parseSchemaSong", () => {
	it("reads title, artist, tempo and validated voicings from the split payload", () => {
		expect(parseSongPayload(PAGE)).toEqual({
			title: "Antisocial",
			artist: "Ed Sheeran",
			bpm: 153,
			voicings: { Bbm: "x1332x", Fm: "xx3111", Ebm: "x6887x" },
		});
		expect(parseSongPayload("<html></html>")).toBeNull();
	});

	it("reads the schema.org block", () => {
		expect(parseSchemaSong(PAGE)).toEqual({
			title: "Antisocial",
			artist: "Ed Sheeran",
			key: "Bbm",
			bpm: 153,
		});
	});
});

describe("extractGuitarTunaPage", () => {
	it("assembles the song", () => {
		const result = extractGuitarTunaPage(PAGE, URL);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.song).toEqual({
			title: "Antisocial",
			artist: "Ed Sheeran",
			sheet: sheetFromGuitarTunaHtml(SHEET_HTML),
			source: "guitartuna",
			url: URL,
			key: "Bbm",
			tuning: "E A D G B E",
			tempo: 153,
			voicings: { Bbm: "x1332x", Fm: "xx3111", Ebm: "x6887x" },
		});
	});

	it("falls back to the schema block without a payload and reads a capo from the meta row", () => {
		const page = `<html><body>${SCHEMA}${SHEET_HTML}${META.replace("<span>Difficulty: Easy</span>", "<span>Capo: 2</span>")}</body></html>`;
		const result = extractGuitarTunaPage(page);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.song.title).toBe("Antisocial");
		expect(result.song.tempo).toBe(153);
		expect(result.song.capo).toBe(2);
		expect(result.song.voicings).toBeUndefined();
		expect(result.song.url).toBeUndefined();
	});

	it("reports a page without a sheet", () => {
		const result = extractGuitarTunaPage("<html></html>");
		expect(result.ok).toBe(false);
	});
});
