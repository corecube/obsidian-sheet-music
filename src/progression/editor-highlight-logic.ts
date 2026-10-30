/**
 * Token classification for ```progression blocks while they are edited.
 * Pure: mirrors the colours of the rendered table (harmonic function per
 * numeral) plus keys, chord names, RomanText markers, metadata and comments.
 */
import { fencedBodyRanges } from "../chords/editor-highlight-logic";
import { Chord } from "tonal";
import { commentStart, firstKeyLineIndex, isMetadataLine, parseRepeat } from "./lines";
import { harmonicFunction, isRomanToken, parseKey, type HarmonicFunction, type KeyContext } from "./roman";

export type ProgressionHighlightClass = HarmonicFunction | "key" | "chord" | "marker" | "comment" | "meta";

export interface ProgressionHighlightSpan {
	from: number;
	to: number;
	cls: ProgressionHighlightClass;
}

export interface ProgressionLineHighlight {
	/** 0-based line index in the document. */
	line: number;
	spans: ProgressionHighlightSpan[];
}

const MARKER_RE = /^(m\d+[a-z0-9]*|b\d+(\.\d+)?|\|\||NC)$/;

export function progressionBodyRanges(lines: string[]): Array<[number, number]> {
	return fencedBodyRanges(lines, "progression");
}

/**
 * Highlight spans for one body line. `state.key` carries the current key
 * across lines and is updated by the key line and inline key tokens.
 */
export function highlightProgressionLine(
	text: string,
	state: { key: KeyContext | null },
	isKeyLine = false,
): ProgressionHighlightSpan[] {
	const spans: ProgressionHighlightSpan[] = [];
	const cStart = commentStart(text);
	const code = cStart >= 0 ? text.slice(0, cStart) : text;
	if (cStart >= 0 && cStart < text.length) spans.push({ from: cStart, to: text.length, cls: "comment" });

	const trimmed = code.trim();
	if (trimmed.length === 0) return spans;
	const indent = code.indexOf(trimmed);

	if (isMetadataLine(trimmed)) {
		spans.unshift({ from: indent, to: indent + trimmed.length, cls: "meta" });
		return spans;
	}
	if (parseRepeat(trimmed)) {
		spans.unshift({ from: indent, to: indent + trimmed.length, cls: "marker" });
		return spans;
	}
	if (isKeyLine) {
		state.key = parseKey(trimmed);
		spans.unshift({ from: indent, to: indent + trimmed.length, cls: "key" });
		return spans;
	}

	const tokenSpans: ProgressionHighlightSpan[] = [];
	for (const match of code.matchAll(/\S+/g)) {
		const token = match[0];
		const from = match.index ?? 0;
		const to = from + token.length;
		let cls: ProgressionHighlightClass | null = null;

		if (token.endsWith(":") && parseKey(token)) {
			state.key = parseKey(token);
			cls = "key";
		} else if (MARKER_RE.test(token)) {
			cls = "marker";
		} else if (state.key && isRomanToken(token, state.key)) {
			cls = harmonicFunction(token, state.key);
		} else if (Chord.get(token).tonic) {
			cls = "chord";
		}

		if (cls) tokenSpans.push({ from, to, cls });
	}
	return [...tokenSpans, ...spans];
}

/**
 * Highlights for the progression body lines within `[fromLine, toLine]`
 * (0-based, inclusive). Every block is scanned from its start so the key
 * context is right even when only part of it is visible.
 */
export function progressionHighlights(
	lines: string[],
	fromLine: number,
	toLine: number,
): ProgressionLineHighlight[] {
	const out: ProgressionLineHighlight[] = [];
	for (const [start, end] of progressionBodyRanges(lines)) {
		if (end < fromLine || start > toLine) continue;
		const state = { key: null as KeyContext | null };
		const keyLine = firstKeyLineIndex(lines.slice(start, end + 1));
		for (let i = start; i <= end; i++) {
			const spans = highlightProgressionLine(lines[i] ?? "", state, i - start === keyLine);
			if (i >= fromLine && i <= toLine) out.push({ line: i, spans });
		}
	}
	return out;
}
