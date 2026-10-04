import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	type PluginValue,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import {
	chordsHighlights,
	type HighlightClass,
} from "./editor-highlight-logic";

const MARKS: Record<HighlightClass, Decoration> = {
	bracket: Decoration.mark({ class: "cm-chords-bracket" }),
	chord: Decoration.mark({ class: "cm-chords-chord" }),
	section: Decoration.mark({ class: "cm-chords-section" }),
};
const TRANSLATION_LINE = Decoration.line({ class: "cm-chords-translation" });
const SECTION_LINE = Decoration.line({ class: "cm-chords-section-line" });

function buildDecorations(view: EditorView): DecorationSet {
	const doc = view.state.doc;
	const lines = doc.toString().split("\n");
	const builder = new RangeSetBuilder<Decoration>();
	for (const range of view.visibleRanges) {
		const fromLine = doc.lineAt(range.from).number - 1;
		const toLine = doc.lineAt(range.to).number - 1;
		for (const hl of chordsHighlights(lines, fromLine, toLine)) {
			const line = doc.line(hl.line + 1);
			if (hl.translation) builder.add(line.from, line.from, TRANSLATION_LINE);
			if (hl.section) builder.add(line.from, line.from, SECTION_LINE);
			for (const span of hl.spans) {
				builder.add(line.from + span.from, line.from + span.to, MARKS[span.cls]);
			}
		}
	}
	return builder.finish();
}

class ChordsHighlightPlugin implements PluginValue {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate): void {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildDecorations(update.view);
		}
	}
}

/**
 * Editor extension that colours chord and section tokens inside ```chords
 * blocks while they are being edited (source mode and Live Preview with
 * the cursor inside the block), matching the rendered block's styling.
 */
export function chordsEditorHighlight() {
	return ViewPlugin.fromClass(ChordsHighlightPlugin, {
		decorations: (plugin) => plugin.decorations,
	});
}
