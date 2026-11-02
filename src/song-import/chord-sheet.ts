/**
 * Converts chords-over-lyrics text (any site, with or without Ultimate
 * Guitar's [ch]/[tab] markup) into `chords` block lines with inline
 * bracketed chords. No Obsidian or DOM imports.
 */

import { isSectionLine, tokenizeChordsLine } from "../chords/renderer-logic";

const ROOT = "[A-G](?:#|b)?";
const SUFFIX = "(?:maj|min|dim|aug|sus|add|m|M|\\+|-|°|ø|b|#|\\(|\\)|[0-9])*";
const CHORD_PATTERN = new RegExp(`^${ROOT}${SUFFIX}(?:/${ROOT})?$`);
/** Tokens allowed on a chord line that are not chords; kept unbracketed. */
const ANNOTATION_PATTERN = /^(?:N\.?C\.?|\(?x\d+\)?|\(?\d+x\)?|\||-|~|%)$/i;
const TAB_LINE_PATTERN =
	/^\s*(?:[A-Ga-g][#b]?)?\s*\|?[-0-9xXhpbrs~^v*.()/\\|\s]*$/;
const CH_MARKER_PATTERN = /\[ch\](.*?)\[\/ch\]/g;

export function isChordToken(token: string): boolean {
	return CHORD_PATTERN.test(token);
}

function isTablatureLine(line: string): boolean {
	return line.includes("--") && TAB_LINE_PATTERN.test(line);
}

interface Placement {
	text: string;
	/** Column of the token's first character within the stripped line. */
	col: number;
	bracket: boolean;
}

type Line =
	| { kind: "blank" }
	| { kind: "section"; text: string }
	| { kind: "tablature"; raw: string }
	| { kind: "chords"; placements: Placement[]; text: string; header?: string }
	| { kind: "lyric"; text: string; header?: string };

function stripChordMarkers(raw: string): {
	stripped: string;
	marked: Placement[];
} {
	let stripped = "";
	let last = 0;
	const marked: Placement[] = [];
	for (const match of raw.matchAll(CH_MARKER_PATTERN)) {
		const start = match.index ?? 0;
		const name = match[1] ?? "";
		stripped += raw.slice(last, start);
		marked.push({
			text: name,
			col: stripped.length,
			bracket: isChordToken(name),
		});
		stripped += name;
		last = start + match[0].length;
	}
	stripped += raw.slice(last);
	return { stripped, marked };
}

function tokenize(text: string): { text: string; col: number }[] {
	const tokens: { text: string; col: number }[] = [];
	for (const match of text.matchAll(/\S+/g)) {
		tokens.push({ text: match[0], col: match.index ?? 0 });
	}
	return tokens;
}

function blankOut(text: string, placements: Placement[]): string {
	let out = text;
	for (const p of [...placements].sort((a, b) => b.col - a.col)) {
		out =
			out.slice(0, p.col) +
			" ".repeat(p.text.length) +
			out.slice(p.col + p.text.length);
	}
	return out;
}

/** Replaces each marked chord name in a lyric line with its bracketed form. */
function bracketInPlace(placements: Placement[], text: string): string {
	let out = text;
	for (const p of [...placements].sort((a, b) => b.col - a.col)) {
		if (!p.bracket) continue;
		out =
			out.slice(0, p.col) + `[${p.text}]` + out.slice(p.col + p.text.length);
	}
	return out;
}

function classifyLine(raw: string, markersPresent: boolean): Line {
	const { stripped, marked } = stripChordMarkers(raw);
	if (stripped.trim() === "") return { kind: "blank" };
	if (isTablatureLine(stripped)) return { kind: "tablature", raw: stripped };

	let header: string | undefined;
	let bodyStart = 0;
	const headerMatch = /^\s*(\[[^\]]+\])\s*/.exec(stripped);
	if (headerMatch) {
		header = headerMatch[1];
		bodyStart = headerMatch[0].length;
	}
	const body = stripped.slice(bodyStart);
	if (header && body.trim() === "") return { kind: "section", text: header };

	const placements = marked
		.filter((p) => p.col >= bodyStart)
		.map((p) => ({ ...p, col: p.col - bodyStart }));

	if (placements.length > 0) {
		const others = tokenize(blankOut(body, placements));
		if (others.every((t) => ANNOTATION_PATTERN.test(t.text))) {
			const all = [
				...placements,
				...others.map((t) => ({ text: t.text, col: t.col, bracket: false })),
			].sort((a, b) => a.col - b.col);
			return { kind: "chords", placements: all, text: body, header };
		}
		return { kind: "lyric", text: bracketInPlace(placements, body), header };
	}

	if (!markersPresent) {
		const tokens = tokenize(body);
		if (
			tokens.some((t) => isChordToken(t.text)) &&
			tokens.every(
				(t) => isChordToken(t.text) || ANNOTATION_PATTERN.test(t.text),
			)
		) {
			return {
				kind: "chords",
				header,
				text: body,
				placements: tokens.map((t) => ({
					text: t.text,
					col: t.col,
					bracket: isChordToken(t.text),
				})),
			};
		}
	}

	return { kind: "lyric", text: body, header };
}

/**
 * Inserts the chords of a chord line into the lyric below at their columns.
 * The lyric's indentation is removed first (Ultimate Guitar indents lyrics
 * to line them up under chords), so a chord over the indent lands where the
 * text starts.
 */
function mergeChords(placements: Placement[], lyric: string): string {
	const text = lyric.trimStart();
	const indent = lyric.length - text.length;
	const shifted = placements.map((p) => ({ ...p, col: Math.max(0, p.col - indent) }));
	const maxCol = shifted.reduce((max, p) => Math.max(max, p.col), 0);
	let result = text.length < maxCol ? text.padEnd(maxCol) : text;
	for (const p of [...shifted].sort((a, b) => b.col - a.col)) {
		const token = p.bracket ? `[${p.text}]` : p.text;
		result = result.slice(0, p.col) + token + result.slice(p.col);
	}
	return result;
}

/** Collapses the alignment spacing of a lyric or chord line. */
function tidySpaces(line: string): string {
	return line.replace(/ {2,}/g, " ").trim();
}

/**
 * Lays the block out as sections: a blank line before and after every
 * section header and none anywhere else.
 */
function layoutSections(items: { text: string; section: boolean }[]): string[] {
	const out: string[] = [];
	for (const item of items) {
		if (item.section) {
			if (out.length > 0 && out[out.length - 1] !== "") out.push("");
			out.push(item.text, "");
		} else {
			out.push(item.text);
		}
	}
	while (out.length > 0 && out[out.length - 1] === "") out.pop();
	return out;
}

/**
 * Converts chords-over-lyrics text into `chords` block lines.
 */
export function convertChordSheet(text: string): string[] {
	const normalized = text
		.replace(/\r\n?/g, "\n")
		.replace(/&nbsp;/g, " ")
		.replace(/\u00a0/g, " ")
		.replace(/\t/g, " ")
		.replace(/\[\/?tab\]/g, "");
	const markersPresent = normalized.includes("[ch]");
	const lines = normalized
		.split("\n")
		.map((line) => classifyLine(line, markersPresent));

	const out: { text: string; section: boolean }[] = [];
	const push = (text: string): void => {
		out.push({ text, section: false });
	};
	const pushSection = (text: string): void => {
		out.push({ text, section: true });
	};
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		switch (line.kind) {
			case "blank":
				break;
			case "section":
				pushSection(line.text);
				break;
			case "tablature":
				push(line.raw);
				break;
			case "lyric":
				if (line.header) pushSection(line.header);
				push(tidySpaces(line.text));
				break;
			case "chords": {
				if (line.header) pushSection(line.header);
				const next = lines[i + 1];
				if (next?.kind === "lyric") {
					if (next.header) pushSection(next.header);
					push(tidySpaces(mergeChords(line.placements, next.text)));
					i++;
				} else {
					push(tidySpaces(bracketInPlace(line.placements, line.text)));
				}
				break;
			}
		}
	}
	return layoutSections(out);
}

/**
 * Removes chord markers that repeat the chord already in effect, so
 * `[C]la la [C]la` / `[C]la` becomes `[C]la la la` / `la`. Section headers
 * reset the current chord; lines left empty by the removal are dropped.
 */
export function dropRepeatedChords(lines: string[]): string[] {
	const out: string[] = [];
	let current: string | null = null;
	for (const line of lines) {
		// A lone chord such as `[C]` matches the section pattern but is a chord.
		if (isSectionLine(line) && !isChordToken(line.trim().slice(1, -1))) {
			current = null;
			out.push(line);
			continue;
		}
		let changed = false;
		let text = "";
		for (const token of tokenizeChordsLine(line)) {
			if (token.type !== "bracket") {
				text += token.value;
				continue;
			}
			const name = token.value.slice(1, -1);
			if (name === current) {
				changed = true;
				continue;
			}
			current = name;
			text += token.value;
		}
		if (!changed) {
			out.push(line);
		} else if (text.trim() !== "") {
			out.push(text.trimEnd());
		}
	}
	return out;
}
