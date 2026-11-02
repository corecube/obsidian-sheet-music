/**
 * Ultimate Guitar (tabs.ultimate-guitar.com) chords pages. The song lives in
 * the `js-store` JSON of the page: tab text with [ch]/[tab] markup, song
 * metadata, strumming patterns and chord voicings (`applicature`).
 */

import { StrokeToken } from "../../strumming/stroke-token";
import {
	decodeHtmlEntities,
	findDeep,
	isRecord,
	pathGet,
	stringField,
	type Rec,
} from "../extract-utils";
import type {
	ExtractResult,
	ImportedSong,
	SongSource,
	StrummingPattern,
} from "../song";
import { isFretArray, spelledFretString } from "../voicings";

export const ULTIMATE_GUITAR_ID = "ultimate-guitar";

function findStoreAttribute(html: string): string | null {
	const classIdx = html.search(/class=["'][^"']*\bjs-store\b/);
	if (classIdx < 0) return null;
	const tagStart = html.lastIndexOf("<", classIdx);
	if (tagStart < 0) return null;
	// Attribute order varies; quotes inside the value are entity-encoded, so a
	// lazy match up to the same quote character is safe.
	const match = /data-content=(["'])([\s\S]*?)\1/.exec(html.slice(tagStart));
	return match?.[2] ?? null;
}

function describeKeys(store: unknown): string[] {
	const keys = isRecord(store) ? Object.keys(store) : [];
	const data = pathGet(store, ["store", "page", "data"]);
	if (isRecord(data)) {
		keys.push(...Object.keys(data).map((k) => `store.page.data.${k}`));
	}
	return keys;
}

const KNOWN_STROKES = new Set<number>(Object.values(StrokeToken));

/**
 * Reads Ultimate Guitar's `strummings` array. Stroke codes are the same as
 * the plugin's stroke tokens; unknown codes become rests. Quarter-note
 * patterns (`denuminator` 4) are expanded to eighths with a sustain after
 * each stroke, since the block supports 8 and 16 only.
 */
export function parseStrummings(raw: unknown): StrummingPattern[] {
	if (!Array.isArray(raw)) return [];
	const out: StrummingPattern[] = [];
	for (const item of raw) {
		if (!isRecord(item) || !Array.isArray(item["measures"])) continue;
		let measures = item["measures"].map((m: unknown): number => {
			const code = Number(isRecord(m) ? m["measure"] : m);
			return KNOWN_STROKES.has(code) ? code : StrokeToken.Rest;
		});
		if (measures.length === 0) continue;

		const raw = Number(item["denuminator"] ?? item["denominator"]);
		if (raw === 4) {
			measures = measures.flatMap((m) => [m, StrokeToken.Sustain]);
		}
		const pattern: StrummingPattern = {
			denominator: raw === 16 ? 16 : 8,
			isTriplet: Boolean(item["is_triplet"] ?? item["isTriplet"]),
			measures,
		};
		const part = stringField(item, "part");
		if (part) pattern.part = part;
		const bpm = Number(item["bpm"]);
		if (Number.isFinite(bpm) && bpm > 0) pattern.bpm = bpm;
		out.push(pattern);
	}
	return out;
}

// ---------------------------------------------------------------------------
// Chord voicings (`applicature`)

/** Array fields that hold fingering, never fret numbers. */
const FINGER_KEYS = new Set(["finger", "fingers"]);

/** Fret arrays found on a voicing object and its `listCapos` entries, with base fret. */
function fretCandidates(
	voicing: Rec,
	stringCount: number,
): { frets: number[]; base: number }[] {
	const out: { frets: number[]; base: number }[] = [];
	const visit = (obj: Rec): void => {
		const base = ["startFret", "baseFret", "fret"]
			.map((k) => obj[k])
			.find((v): v is number => typeof v === "number" && v > 0);
		for (const [key, value] of Object.entries(obj)) {
			if (FINGER_KEYS.has(key) || !isFretArray(value, stringCount)) continue;
			out.push({ frets: value, base: base ?? 0 });
		}
	};
	visit(voicing);
	const capos = voicing["listCapos"];
	if (Array.isArray(capos)) for (const c of capos) if (isRecord(c)) visit(c);
	return out;
}

/** Picks the first voicing of `name` whose frets spell the chord. */
function firstValidVoicing(
	name: string,
	voicings: unknown[],
	stringCount: number,
): string | null {
	for (const voicing of voicings) {
		if (!isRecord(voicing)) continue;
		for (const { frets, base } of fretCandidates(voicing, stringCount)) {
			const text = spelledFretString(name, frets, base);
			if (text) return text;
		}
	}
	return null;
}

/** Reads Ultimate Guitar's `applicature` map into fret strings per chord. */
export function parseApplicature(
	raw: unknown,
	stringCount: 4 | 6,
): Record<string, string> {
	const out: Record<string, string> = {};
	if (!isRecord(raw)) return out;
	for (const [name, voicings] of Object.entries(raw)) {
		if (!Array.isArray(voicings)) continue;
		const text = firstValidVoicing(name, voicings, stringCount);
		if (text) out[name] = text;
	}
	return out;
}

function failure(reason: string, keys: string[]): ExtractResult {
	return {
		ok: false,
		message:
			"Could not find tab content on that page (see the developer console).",
		debug: { reason, keys },
	};
}

/** Locates the `js-store` JSON on an Ultimate Guitar page and reads the tab. */
export function extractUgPage(html: string, url?: string): ExtractResult {
	const raw = findStoreAttribute(html);
	if (raw === null) return failure("no-store", []);

	let store: unknown;
	try {
		store = JSON.parse(decodeHtmlEntities(raw));
	} catch {
		return failure("bad-json", []);
	}
	const keys = describeKeys(store);
	const data = pathGet(store, ["store", "page", "data"]);

	let content: string | undefined;
	const wiki = pathGet(data, ["tab_view", "wiki_tab"]);
	if (isRecord(wiki) && typeof wiki["content"] === "string") {
		content = wiki["content"];
	}
	if (content === undefined) {
		const holder = findDeep(
			store,
			(o) =>
				isRecord(o["wiki_tab"]) &&
				typeof o["wiki_tab"]["content"] === "string",
		);
		if (holder) content = (holder["wiki_tab"] as Rec)["content"] as string;
	}
	if (content === undefined) {
		const holder = findDeep(
			store,
			(o) =>
				typeof o["content"] === "string" &&
				/\[(?:ch|tab)\]/.test(o["content"]),
		);
		if (holder) content = holder["content"] as string;
	}
	if (content === undefined) {
		return failure("no-content", keys);
	}

	let tab = pathGet(data, ["tab"]);
	if (!isRecord(tab) || typeof tab["song_name"] !== "string") {
		tab = findDeep(
			store,
			(o) =>
				typeof o["song_name"] === "string" &&
				typeof o["artist_name"] === "string",
		);
	}
	const tabRec = isRecord(tab) ? tab : undefined;

	let meta = pathGet(data, ["tab_view", "meta"]);
	if (!isRecord(meta) || !("capo" in meta)) {
		meta = findDeep(store, (o) => "capo" in o);
	}
	const metaRec = isRecord(meta) ? meta : undefined;

	const type =
		stringField(tabRec, "type_name") ?? stringField(tabRec, "type") ?? "";
	if (!/chords/i.test(type)) {
		return {
			ok: false,
			message: `Only chord pages can be imported; this page is of type "${type}".`,
		};
	}

	const page: ImportedSong = {
		title: stringField(tabRec, "song_name") ?? "",
		artist: stringField(tabRec, "artist_name") ?? "",
		sheet: decodeHtmlEntities(content),
		source: ULTIMATE_GUITAR_ID,
	};
	if (url) page.url = url;
	const key = stringField(tabRec, "tonality_name");
	if (key) page.key = key;
	const capo = Number(metaRec?.["capo"]);
	if (Number.isFinite(capo) && capo > 0) page.capo = capo;
	const tuning = metaRec?.["tuning"];
	const tuningName = isRecord(tuning)
		? (stringField(tuning, "name") ?? stringField(tuning, "value"))
		: typeof tuning === "string" && tuning.trim() !== ""
			? tuning
			: undefined;
	if (tuningName) page.tuning = tuningName;

	let strummings = pathGet(data, ["tab_view", "strummings"]);
	if (!Array.isArray(strummings)) {
		strummings = findDeep(store, (o) => Array.isArray(o["strummings"]))?.[
			"strummings"
		];
	}
	const patterns = parseStrummings(strummings);
	if (patterns.length > 0) page.strummings = patterns;

	let applicature = pathGet(data, ["tab_view", "applicature"]);
	if (!isRecord(applicature)) {
		applicature = findDeep(store, (o) => isRecord(o["applicature"]))?.[
			"applicature"
		];
	}
	const voicings = parseApplicature(
		applicature,
		/ukulele/i.test(type) ? 4 : 6,
	);
	if (Object.keys(voicings).length > 0) page.voicings = voicings;

	return { ok: true, song: page };
}

const UG_URL_PATTERN =
	/^https?:\/\/(?:[a-z0-9-]+\.)*ultimate-guitar\.com\/\S*$/i;

export function isUgUrl(input: string): boolean {
	const trimmed = input.trim();
	return !trimmed.includes("\n") && UG_URL_PATTERN.test(trimmed);
}

export const ultimateGuitarSource: SongSource = {
	id: ULTIMATE_GUITAR_ID,
	name: "Ultimate Guitar",
	frontmatterKey: "ultimateguitar",
	matches: isUgUrl,
	extract: extractUgPage,
};
