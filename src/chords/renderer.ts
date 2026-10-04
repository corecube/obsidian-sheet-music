import { MarkdownPostProcessorContext, Plugin, TFile } from "obsidian";
import { type ChordInstrument, renderChordChips } from "./chord-chips";
import { chordsEditorHighlight } from "./editor-highlight";
import {
	buildChordChipsModel,
	transposeBlockInNote,
} from "./chord-chips-logic";
import {
	isSectionLine,
	splitChordsLines,
	tokenizeChordsLine,
} from "./renderer-logic";
import { TRANSLATION_PREFIX, isTranslationLine } from "./translate-logic";
import { registerTranslateCommands } from "./translate-command";
import {
	applyTranslationsClass,
	TRANSLATIONS_HIDDEN_CLASS,
} from "./translation-visibility";
import { transposeSource } from "./transpose";

/** View type of the former right-sidebar pane; stale leaves are closed. */
const LEGACY_CHORDS_VIEW_TYPE = "sheet-music-chords";

/**
 * Open diagram panels per block, keyed by note path and block start line,
 * so the diagrams a user is looking at survive the re-render after
 * transposing.
 */
const openPanels = new Map<string, ReadonlySet<ChordInstrument>>();

class ChordsBlockRenderer {
	constructor(
		private readonly plugin: Plugin,
		private readonly el: HTMLElement,
		private readonly ctx: MarkdownPostProcessorContext,
	) {}

	private renderLine(container: HTMLElement, line: string): void {
		const row = container.createDiv({ cls: "chords-notation-line" });
		if (isTranslationLine(line)) {
			row.addClass("chords-notation-line-translation");
			row.createSpan({ text: line.slice(TRANSLATION_PREFIX.length) });
			return;
		}
		const sectionLine = isSectionLine(line);
		if (sectionLine) row.addClass("chords-notation-line-section");

		for (const token of tokenizeChordsLine(line)) {
			if (token.type === "text") {
				row.createSpan({ text: token.value });
				continue;
			}
			const inner = token.value.slice(1, -1);
			const cls = sectionLine
				? "chords-notation-token chords-notation-section-token"
				: "chords-notation-token chords-notation-chord-token";
			row.createSpan({ cls: "chords-notation-bracket-token", text: "[" });
			row.createSpan({ cls, text: inner });
			row.createSpan({ cls: "chords-notation-bracket-token", text: "]" });
		}
	}

	private blockKey(): string | null {
		const info = this.ctx.getSectionInfo(this.el);
		return info ? `${this.ctx.sourcePath}:${info.lineStart}` : null;
	}

	private frontmatterKey(): string {
		const fm = this.ctx.frontmatter as Record<string, unknown> | null;
		const key = fm?.["key"];
		return typeof key === "string" ? key : "";
	}

	render(source: string): void {
		this.el.addClass("chords-notation-block");

		const key = this.blockKey();
		renderChordChips(
			this.el,
			buildChordChipsModel(source, this.frontmatterKey()),
			{
				open: (key && openPanels.get(key)) || new Set(),
				onChange: (open) => {
					if (!key) return;
					if (open.size === 0) openPanels.delete(key);
					else openPanels.set(key, open);
				},
				onTranspose: (semitones) => void this.transpose(semitones),
			},
		);

		const contentEl = this.el.createDiv({ cls: "chords-notation-content" });
		for (const line of splitChordsLines(source))
			this.renderLine(contentEl, line);
	}

	/** Rewrites this block in the note; works in reading view and on mobile. */
	private async transpose(semitones: number): Promise<void> {
		const info = this.ctx.getSectionInfo(this.el);
		const file = this.plugin.app.vault.getAbstractFileByPath(
			this.ctx.sourcePath,
		);
		if (!info || !(file instanceof TFile)) return;
		await this.plugin.app.vault.process(file, (content) =>
			transposeBlockInNote(
				content,
				info.lineStart,
				info.lineEnd,
				semitones,
				transposeSource,
			),
		);
	}
}

export function registerChordsPackage(plugin: Plugin): void {
	applyTranslationsClass(plugin);
	plugin.register(() => document.body.removeClass(TRANSLATIONS_HIDDEN_CLASS));
	registerTranslateCommands(plugin);
	plugin.registerMarkdownCodeBlockProcessor("chords", (source, el, ctx) => {
		new ChordsBlockRenderer(plugin, el, ctx).render(source);
	});
	plugin.registerEditorExtension(chordsEditorHighlight());
	// Saved layouts may still contain the removed sidebar pane; without its
	// view type Obsidian would otherwise keep an empty placeholder tab.
	plugin.app.workspace.onLayoutReady(() => {
		plugin.app.workspace.detachLeavesOfType(LEGACY_CHORDS_VIEW_TYPE);
	});
}
