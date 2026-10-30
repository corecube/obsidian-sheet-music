import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	type PluginValue,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";

export interface HighlightSpan<C extends string> {
	from: number;
	to: number;
	cls: C;
}

export interface HighlightedLine<C extends string, L extends string = never> {
	/** 0-based line index in the document. */
	line: number;
	spans: HighlightSpan<C>[];
	/** Whole-line decorations. */
	lineClasses?: L[];
}

export interface FencedHighlightOptions<C extends string, L extends string = never> {
	/** CSS class per span class. */
	marks: Record<C, string>;
	/** CSS class per line class. */
	lineMarks?: Record<L, string>;
	/** Pure function: highlights for the body lines within [fromLine, toLine] (0-based, inclusive). */
	highlights: (lines: string[], fromLine: number, toLine: number) => HighlightedLine<C, L>[];
}

/**
 * CodeMirror extension that decorates fenced code blocks while they are edited,
 * driven by a pure per-line highlight function. Shared by the chords and
 * progression packages.
 */
export function fencedHighlightExtension<C extends string, L extends string = never>(
	options: FencedHighlightOptions<C, L>,
) {
	const marks = Object.fromEntries(
		Object.entries(options.marks).map(([cls, css]) => [cls, Decoration.mark({ class: css as string })]),
	) as Record<C, Decoration>;
	const lineMarks = Object.fromEntries(
		Object.entries(options.lineMarks ?? {}).map(([cls, css]) => [cls, Decoration.line({ class: css as string })]),
	) as Record<L, Decoration>;

	const build = (view: EditorView): DecorationSet => {
		const doc = view.state.doc;
		const lines = doc.toString().split("\n");
		const builder = new RangeSetBuilder<Decoration>();
		for (const range of view.visibleRanges) {
			const fromLine = doc.lineAt(range.from).number - 1;
			const toLine = doc.lineAt(range.to).number - 1;
			for (const hl of options.highlights(lines, fromLine, toLine)) {
				const line = doc.line(hl.line + 1);
				for (const cls of hl.lineClasses ?? []) builder.add(line.from, line.from, lineMarks[cls]);
				const sorted = [...hl.spans].sort((a, b) => a.from - b.from);
				for (const span of sorted) {
					if (span.to <= span.from) continue;
					builder.add(line.from + span.from, line.from + span.to, marks[span.cls]);
				}
			}
		}
		return builder.finish();
	};

	class FencedHighlightPlugin implements PluginValue {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = build(view);
		}
		update(update: ViewUpdate): void {
			if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
		}
	}

	return ViewPlugin.fromClass(FencedHighlightPlugin, { decorations: (plugin) => plugin.decorations });
}
