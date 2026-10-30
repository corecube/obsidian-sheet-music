import { fencedHighlightExtension } from "../utils/fenced-highlight";
import { progressionHighlights, type ProgressionHighlightClass } from "./editor-highlight-logic";

const MARKS: Record<ProgressionHighlightClass, string> = {
	tonic: "cm-progression-fn-tonic",
	predominant: "cm-progression-fn-predominant",
	dominant: "cm-progression-fn-dominant",
	applied: "cm-progression-fn-applied",
	chromatic: "cm-progression-fn-chromatic",
	key: "cm-progression-key",
	chord: "cm-progression-chord",
	marker: "cm-progression-marker",
	comment: "cm-progression-comment",
	meta: "cm-progression-meta",
};

/**
 * Editor extension that colours ```progression blocks while they are edited
 * (source mode and Live Preview with the cursor inside the block): numerals
 * by harmonic function, keys, chord names, RomanText markers and comments.
 */
export function progressionEditorHighlight() {
	return fencedHighlightExtension({ marks: MARKS, highlights: progressionHighlights });
}
