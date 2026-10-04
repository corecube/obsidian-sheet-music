import { isSectionLine, tokenizeChordsLine } from "./renderer-logic";
import { isTranslationLine } from "./translate-logic";

const FENCE_OPEN_RE = /^(`{3,})\s*(\S*)/;

export type HighlightClass = "bracket" | "chord" | "section";

/** A highlighted span inside a line, as 0-based column offsets. */
export interface HighlightSpan {
	from: number;
	to: number;
	cls: HighlightClass;
}

export interface LineHighlight {
	/** 0-based line index in the document. */
	line: number;
	/** `> ` translation line: dimmed as a whole, no token spans. */
	translation: boolean;
	/** Line consisting of a single `[Section]` header: bold as a whole. */
	section: boolean;
	spans: HighlightSpan[];
}

/**
 * 0-based inclusive line ranges of the bodies of every ```chords block.
 * Unlike the renderer, a fence that is still unclosed (the user is typing
 * it) runs to the end of the document so highlighting appears right away.
 */
export function chordsBodyRanges(lines: string[]): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	for (let i = 0; i < lines.length; i++) {
		const open = FENCE_OPEN_RE.exec(lines[i] ?? "");
		if (!open) continue;
		const fence = open[1] ?? "";
		const isChords = (open[2] ?? "") === "chords";
		const closeRe = new RegExp(`^\`{${fence.length},}\\s*$`);
		let end = lines.length;
		for (let j = i + 1; j < lines.length; j++) {
			if (closeRe.test(lines[j] ?? "")) {
				end = j;
				break;
			}
		}
		if (isChords && end > i + 1) ranges.push([i + 1, end - 1]);
		i = end;
	}
	return ranges;
}

/** Highlight spans for one chords body line. */
export function highlightLine(
	text: string,
): Omit<LineHighlight, "line"> {
	if (isTranslationLine(text)) {
		return { translation: true, section: false, spans: [] };
	}
	const section = isSectionLine(text);
	const spans: HighlightSpan[] = [];
	let col = 0;
	for (const token of tokenizeChordsLine(text)) {
		const len = token.value.length;
		if (token.type === "bracket") {
			spans.push({ from: col, to: col + 1, cls: "bracket" });
			spans.push({
				from: col + 1,
				to: col + len - 1,
				cls: section ? "section" : "chord",
			});
			spans.push({ from: col + len - 1, to: col + len, cls: "bracket" });
		}
		col += len;
	}
	return { translation: false, section, spans };
}

/**
 * Highlights for the chords body lines within `[fromLine, toLine]`
 * (0-based, inclusive), in document order.
 */
export function chordsHighlights(
	lines: string[],
	fromLine: number,
	toLine: number,
): LineHighlight[] {
	const out: LineHighlight[] = [];
	for (const [start, end] of chordsBodyRanges(lines)) {
		const lo = Math.max(start, fromLine);
		const hi = Math.min(end, toLine);
		for (let i = lo; i <= hi; i++) {
			out.push({ line: i, ...highlightLine(lines[i] ?? "") });
		}
	}
	return out;
}
