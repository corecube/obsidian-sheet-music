import { fencedHighlightExtension } from "../utils/fenced-highlight";
import { chordsHighlights, type HighlightClass } from "./editor-highlight-logic";

const MARKS: Record<HighlightClass, string> = {
	bracket: "cm-chords-bracket",
	chord: "cm-chords-chord",
	section: "cm-chords-section",
};
const LINE_MARKS = {
	translation: "cm-chords-translation",
	section: "cm-chords-section-line",
} as const;

/**
 * Editor extension that colours chord and section tokens inside ```chords
 * blocks while they are being edited (source mode and Live Preview with
 * the cursor inside the block), matching the rendered block's styling.
 */
export function chordsEditorHighlight() {
	return fencedHighlightExtension<HighlightClass, keyof typeof LINE_MARKS>({
		marks: MARKS,
		lineMarks: LINE_MARKS,
		highlights: (lines, fromLine, toLine) =>
			chordsHighlights(lines, fromLine, toLine).map((hl) => ({
				line: hl.line,
				spans: hl.spans,
				lineClasses: [...(hl.translation ? (["translation"] as const) : []), ...(hl.section ? (["section"] as const) : [])],
			})),
	});
}
