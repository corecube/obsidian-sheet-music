/**
 * Source-independent part of the song importer: pasted-text handling, note
 * and frontmatter building. No Obsidian or DOM imports.
 */

import { collectBlockChords } from "../chords/chord-chips-logic";
import { convertChordSheet, dropRepeatedChords } from "./chord-sheet";
import type { ImportedSong, StrummingPattern } from "./song";
import { SOURCES } from "./sources";

export function looksLikeUrl(input: string): boolean {
	const trimmed = input.trim();
	return !trimmed.includes("\n") && /^https?:\/\/\S+$/i.test(trimmed);
}

/**
 * Wraps text copied from any site as a song. Leading header lines
 * such as `Let It Be chords by The Beatles`, `Key: C`, `Capo: 2` and
 * `Tuning: Standard` are consumed into the page fields.
 */
export function songFromPastedText(text: string): ImportedSong {
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	const song: ImportedSong = { title: "", artist: "", sheet: "" };
	let i = 0;
	while (i < lines.length) {
		const line = (lines[i] ?? "").trim();
		if (line === "") {
			i++;
			continue;
		}
		const title = /^(.+?)\s+chords\s+by\s+(.+?)$/i.exec(line);
		const key = /^key:\s*([A-G][#b]?m?)$/i.exec(line);
		const capo = /^capo:\s*(\d+)/i.exec(line);
		const tuning = /^tuning:\s*(.+)$/i.exec(line);
		if (title) {
			song.title = title[1] ?? "";
			song.artist = title[2] ?? "";
		} else if (key) {
			const value = key[1] ?? "";
			song.key = value.charAt(0).toUpperCase() + value.slice(1);
		} else if (capo) {
			const value = Number(capo[1]);
			if (value > 0) song.capo = value;
		} else if (tuning) {
			song.tuning = (tuning[1] ?? "").trim();
		} else {
			break;
		}
		i++;
	}
	song.sheet = lines.slice(i).join("\n");
	return song;
}

/**
 * Converts a song's sheet into `chords` block lines. Throws when no chord
 * marker is left, which means the text was not a chord sheet.
 */
export function sheetToLines(
	sheet: string,
	options: { dropRepeatedChords: boolean },
): string[] {
	let lines = convertChordSheet(sheet);
	if (options.dropRepeatedChords) lines = dropRepeatedChords(lines);
	if (!lines.some((line) => /\[[^\]\n]+\]/.test(line))) {
		throw new Error("No chords found in the text.");
	}
	return lines;
}

// ---------------------------------------------------------------------------
// Note building

/** `Am[x02210]` lines for the chords used in `lines`, in order of appearance. */
export function voicingLines(
	lines: string[],
	voicings: Record<string, string> | undefined,
): string[] {
	if (!voicings) return [];
	return collectBlockChords(lines.join("\n"))
		.names.filter((name) => voicings[name] !== undefined)
		.map((name) => `${name}[${voicings[name] ?? ""}]`);
}

/** `Álvaro Soler` → `alvaro_soler`; words joined by underscores. */
export function slugify(text: string): string {
	return text
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

/** Plain scalar when YAML reads it back as the same string, quoted otherwise. */
function yamlScalar(value: string | number | undefined): string {
	if (value === undefined || value === "") return "";
	if (typeof value === "number") return String(value);
	const needsQuotes =
		value !== value.trim() ||
		/[\n"'\\]/.test(value) ||
		/: |\s#/.test(value) ||
		value.endsWith(":") ||
		/^[-?:,[\]{}#&*!|>%@`]/.test(value) ||
		/^(?:true|false|null|yes|no|on|off|~|[+-]?\d[\d.]*)$/i.test(value);
	if (!needsQuotes) return value;
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Frontmatter in the user's song-note template. Fields without a value stay
 * present but empty so the property editor shows them.
 */
export function noteFrontmatter(song: ImportedSong): string {
	const tempo =
		song.tempo ?? song.strummings?.find((s) => s.bpm !== undefined)?.bpm;
	const links: [string, string | undefined][] = SOURCES.map((source) => [
		source.frontmatterKey,
		song.source === source.id ? song.url : undefined,
	]);
	const fields: [string, string | number | undefined][] = [
		["tags", undefined],
		["type", "tab"],
		["autoscroll-speed", 5],
		["title", song.title],
		["artist", song.artist],
		...links,
		["spotify", undefined],
		["youtube", undefined],
		["status", "todo"],
		["key", song.key],
		["capo", song.capo],
		["tempo", tempo],
	];
	const lines = fields.map(([key, value]) => {
		const scalar = yamlScalar(value);
		return scalar ? `${key}: ${scalar}` : `${key}:`;
	});
	return `---\n${lines.join("\n")}\n---\n`;
}

/** Renders a pattern as the JSON the `strumming` block expects. */
export function strummingBlock(pattern: StrummingPattern): string {
	const fields: string[] = [];
	if (pattern.part) fields.push(`"part": ${JSON.stringify(pattern.part)}`);
	if (pattern.bpm !== undefined) fields.push(`"bpm": ${pattern.bpm}`);
	fields.push(`"denominator": ${pattern.denominator}`);
	fields.push(`"isTriplet": ${pattern.isTriplet}`);
	fields.push(`"measures": [${pattern.measures.join(", ")}]`);
	return `\`\`\`strumming\n{\n${fields.map((f) => `    ${f}`).join(",\n")}\n}\n\`\`\`\n`;
}

export function buildNote(args: {
	song: ImportedSong;
	lines: string[];
}): { fileName: string; content: string } {
	const { song, lines } = args;
	const slug =
		[slugify(song.artist), slugify(song.title)].filter(Boolean).join("-") ||
		"imported_song";

	const head = noteFrontmatter(song) + "\n";

	const defs = voicingLines(lines, song.voicings);
	const body = defs.length > 0 ? [...defs, "", ...lines] : lines;
	// Strumming patterns come first so they sit above the lyrics.
	const blocks = [
		...(song.strummings ?? []).map(strummingBlock),
		`\`\`\`chords\n${body.join("\n")}\n\`\`\`\n`,
	];
	return { fileName: `${slug}.md`, content: head + blocks.join("\n") };
}

/** First of `folder/name.md`, `folder/name-2.md`, … for which `exists` is false. */
export function nextAvailablePath(
	folder: string,
	fileName: string,
	exists: (path: string) => boolean,
): string {
	const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
	const prefix = cleanFolder ? `${cleanFolder}/` : "";
	const dot = fileName.lastIndexOf(".");
	const base = dot > 0 ? fileName.slice(0, dot) : fileName;
	const ext = dot > 0 ? fileName.slice(dot) : "";
	let candidate = `${prefix}${base}${ext}`;
	for (let n = 2; exists(candidate); n++) {
		candidate = `${prefix}${base}-${n}${ext}`;
	}
	return candidate;
}
