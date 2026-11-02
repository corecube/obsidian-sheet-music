/**
 * GuitarTuna (guitartuna.com/chords/...) chord pages. The sheet is rendered
 * HTML: `part_type` divs are sections, each `line` div holds `data-chord`
 * spans and a lyric div whose `sr-only` spans sit exactly where the chords
 * fall. Title, artist, tempo and voicings come from the React payload, with
 * the schema.org block and the meta row as fallbacks. Voicing arrays are
 * stored high string first; the shared validator picks the right reading.
 */

import { decodeHtmlEntities, isRecord } from "../extract-utils";
import type { ExtractResult, ImportedSong, SongSource } from "../song";
import { isFretArray, spelledFretString } from "../voicings";

export const GUITARTUNA_ID = "guitartuna";

const GUITARTUNA_URL_PATTERN =
	/^https?:\/\/(?:www\.)?guitartuna\.com\/chords\/[^\s/?#]+/i;

export function isGuitarTunaUrl(input: string): boolean {
	return GUITARTUNA_URL_PATTERN.test(input.trim());
}

function stripTags(html: string): string {
	return decodeHtmlEntities(html.replace(/<[^>]+>/g, ""));
}

/** "Bb minor" → "Bbm", "E major" → "E". */
export function keyFromLabel(label: string): string | undefined {
	const match = /^\s*([A-G][#b]?)\s*(major|minor|maj|min|m)?\s*$/i.exec(label);
	if (!match) return undefined;
	const tonic = (match[1] ?? "").charAt(0).toUpperCase() + (match[1] ?? "").slice(1);
	return /^min|^m$/i.test(match[2] ?? "") ? `${tonic}m` : tonic;
}

/**
 * Converts the rendered sheet into chords-over-lyrics text with [ch] markup.
 * Chord-only lines get a blank line after them so the converter keeps them
 * standalone instead of merging them into the next lyric line.
 */
export function sheetFromGuitarTunaHtml(html: string): string | null {
	const start = html.indexOf('data-testid="song-lyrics"');
	if (start < 0) return null;
	const endIdx = html.indexOf('id="songcontent-end"', start);
	const region = html.slice(start, endIdx < 0 ? undefined : endIdx);

	const out: string[] = [];
	const tokens =
		/<div class="part_type">(.*?)<\/div>|<div class="line"[^>]*>([\s\S]*?)(?=<div class="line"|<div class="partContainer">|$)/g;
	for (const match of region.matchAll(tokens)) {
		const section = match[1];
		if (section !== undefined) {
			out.push(`[${stripTags(section).trim()}]`);
			continue;
		}
		const line = match[2] ?? "";
		const chords = [...line.matchAll(/data-chord="([^"]*)"/g)].map((m) =>
			decodeHtmlEntities(m[1] ?? "").trim(),
		);
		const lyricHtml = /<span><\/span><div>([\s\S]*?)<\/div>/.exec(line)?.[1] ?? "";
		let next = 0;
		const marked = lyricHtml.replace(
			/<span class="sr-only">[\s\S]*?<\/span>/g,
			() => {
				const chord = chords[next++];
				return chord ? `[ch]${chord}[/ch]` : "";
			},
		);
		const unplaced = chords.slice(next).map((c) => `[ch]${c}[/ch]`);
		// Two chords on one syllable: keep them readable as separate tokens.
		const text = stripTags(marked).replace(/\[\/ch\]\[ch\]/g, "[/ch] [ch]").trim();
		const lyricOnly = text.replace(/\[ch\][^[]*\[\/ch\]/g, "").trim();
		if (lyricOnly === "") {
			// Chord-only bar: space the chords out and keep the converter from
			// merging them into the next lyric line.
			if (chords.length > 0) {
				out.push(chords.map((c) => `[ch]${c}[/ch]`).join(" "), "");
			}
			continue;
		}
		out.push([...unplaced, text].join(" "));
	}
	return out.length > 0 ? out.join("\n") : null;
}

/** Joins the React Server Components payload chunks into one string. */
function rscPayload(html: string): string {
	const parts: string[] = [];
	for (const match of html.matchAll(
		/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g,
	)) {
		try {
			parts.push(JSON.parse(`"${match[1] ?? ""}"`) as string);
		} catch {
			// skip a chunk that is not a JSON string literal
		}
	}
	return parts.join("");
}

/** The JSON object starting at `start` (a `{`), or null. */
function objectAt(text: string, start: number): unknown {
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < text.length; i++) {
		const ch = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') inString = true;
		else if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) {
				try {
					return JSON.parse(text.slice(start, i + 1));
				} catch {
					return null;
				}
			}
		}
	}
	return null;
}

interface SongPayload {
	title?: string;
	artist?: string;
	bpm?: number;
	capo?: number;
	voicings: Record<string, string>;
}

/** Title, artist, tempo, capo and chord voicings from the page's React payload. */
export function parseSongPayload(html: string): SongPayload | null {
	const text = rscPayload(html);
	const at = text.indexOf('{"songId"');
	if (at < 0) return null;
	const data = objectAt(text, at);
	if (!isRecord(data)) return null;

	const payload: SongPayload = { voicings: {} };
	if (typeof data["title"] === "string") payload.title = data["title"];
	if (typeof data["artist"] === "string") payload.artist = data["artist"];
	const bpm = Number(data["bpm"]);
	if (Number.isFinite(bpm) && bpm > 0) payload.bpm = bpm;
	for (const key of ["capo", "capoFret", "capoPosition"]) {
		const capo = Number(data[key]);
		if (Number.isFinite(capo) && capo > 0) payload.capo = capo;
	}
	if (Array.isArray(data["chords"])) {
		for (const chord of data["chords"]) {
			if (!isRecord(chord) || typeof chord["name"] !== "string") continue;
			const chordData = chord["chordData"];
			const voicing = isRecord(chordData) ? chordData["voicing"] : undefined;
			if (!isFretArray(voicing, 6)) continue;
			const text = spelledFretString(chord["name"], voicing);
			if (text) payload.voicings[chord["name"]] = text;
		}
	}
	return payload;
}

interface SchemaSong {
	title?: string;
	artist?: string;
	key?: string;
	bpm?: number;
}

/** Title, artist, key and tempo from the schema.org MusicComposition block. */
export function parseSchemaSong(html: string): SchemaSong {
	const out: SchemaSong = {};
	for (const match of html.matchAll(
		/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
	)) {
		let data: unknown;
		try {
			data = JSON.parse(match[1] ?? "");
		} catch {
			continue;
		}
		if (!isRecord(data) || data["@type"] !== "MusicComposition") continue;
		if (typeof data["name"] === "string") {
			out.title = data["name"].replace(/\s*\((?:chords|tabs?)\)\s*$/i, "");
		}
		const composer = data["composer"];
		if (isRecord(composer) && typeof composer["name"] === "string") {
			out.artist = composer["name"];
		}
		if (typeof data["musicalKey"] === "string") {
			out.key = keyFromLabel(data["musicalKey"]);
		}
		if (typeof data["text"] === "string") {
			const bpm = /Tempo:\s*(\d+)/i.exec(data["text"]);
			if (bpm) out.bpm = Number(bpm[1]);
		}
		break;
	}
	return out;
}

/** Tuning and capo from the visible meta row. */
function parseMetaRow(html: string): { tuning?: string; capo?: number } {
	const row = /data-testid="song-meta"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1];
	if (!row) return {};
	const text = stripTags(row.replace(/<!--.*?-->/g, ""));
	const out: { tuning?: string; capo?: number } = {};
	const tuning = /Tuning:\s*([A-G][#b]?(?:\s+[A-G][#b]?){3,5})/i.exec(text);
	if (tuning) out.tuning = tuning[1] ?? undefined;
	const capo = /Capo:?\s*(\d+)/i.exec(text);
	if (capo) out.capo = Number(capo[1]);
	return out;
}

export function extractGuitarTunaPage(html: string, url?: string): ExtractResult {
	const sheet = sheetFromGuitarTunaHtml(html);
	if (sheet === null) {
		return {
			ok: false,
			message:
				"Could not find the chord sheet on that page (see the developer console).",
			debug: { hasSongLyrics: html.includes('data-testid="song-lyrics"') },
		};
	}
	const payload = parseSongPayload(html);
	const schema = parseSchemaSong(html);
	const meta = parseMetaRow(html);

	const song: ImportedSong = {
		title: payload?.title ?? schema.title ?? "",
		artist: payload?.artist ?? schema.artist ?? "",
		sheet,
		source: GUITARTUNA_ID,
	};
	if (url) song.url = url;
	if (schema.key) song.key = schema.key;
	const capo = payload?.capo ?? meta.capo;
	if (capo !== undefined && capo > 0) song.capo = capo;
	if (meta.tuning) song.tuning = meta.tuning;
	const bpm = payload?.bpm ?? schema.bpm;
	if (bpm !== undefined && bpm > 0) song.tempo = bpm;
	if (payload && Object.keys(payload.voicings).length > 0) {
		song.voicings = payload.voicings;
	}
	return { ok: true, song };
}

export const guitarTunaSource: SongSource = {
	id: GUITARTUNA_ID,
	name: "GuitarTuna",
	frontmatterKey: "guitartuna",
	matches: isGuitarTunaUrl,
	extract: extractGuitarTunaPage,
};
