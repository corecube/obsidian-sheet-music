import { MarkdownPostProcessorContext, MarkdownView, Plugin } from "obsidian";
import { Chord } from "svguitar";
import { lookupChord, parseCustomChordDefs } from "./guitar-chord";
import { renderGuitarDiagram } from "./guitar-diagram";
import { lookupPianoChord } from "./piano-chord";
import { renderPianoDiagram } from "./piano-diagram";
import {
	isSectionLine,
	splitChordsLines,
	tokenizeChordsLine,
} from "./renderer-logic";
import { transposeSource } from "./transpose";

const FRET_STRING_RE = /^[xX0-9]+$/;

class ChordsBlockRenderer {
	private readonly plugin: Plugin;
	private readonly el: HTMLElement;
	private readonly ctx: MarkdownPostProcessorContext;
	private customDefs: Map<string, Chord> = new Map();

	constructor(
		plugin: Plugin,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	) {
		this.plugin = plugin;
		this.el = el;
		this.ctx = ctx;
	}

	private renderLine(container: HTMLElement, line: string): void {
		const row = container.createDiv({ cls: "chords-notation-line" });
		const sectionLine = isSectionLine(line);
		if (sectionLine) row.addClass("chords-notation-line-section");

		for (const token of tokenizeChordsLine(line)) {
			if (token.type === "text") {
				row.createSpan({ text: token.value });
				continue;
			}
			const cls = sectionLine
				? "chords-notation-token chords-notation-section-token"
				: "chords-notation-token chords-notation-chord-token";
			const inner = token.value.slice(1, -1);
			row.createSpan({ cls: "chords-notation-bracket-token", text: "[" });
			row.createSpan({ cls, text: inner });
			row.createSpan({ cls: "chords-notation-bracket-token", text: "]" });
		}
	}

	applyTranspose(semitones: number): void {
		const info = this.ctx.getSectionInfo(this.el);
		if (!info) return;
		const { lineStart, lineEnd } = info;
		if (lineStart + 1 > lineEnd - 1) return;
		const view =
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;
		const editor = view.editor;
		const contentLines: string[] = [];
		for (let i = lineStart + 1; i <= lineEnd - 1; i++) {
			contentLines.push(editor.getLine(i));
		}
		editor.replaceRange(
			transposeSource(contentLines.join("\n"), semitones),
			{ line: lineStart + 1, ch: 0 },
			{ line: lineEnd - 1, ch: editor.getLine(lineEnd - 1).length },
		);
	}

	private chordNames(source: string): string[] {
		const seen = new Set<string>(this.customDefs.keys());
		for (const line of splitChordsLines(source)) {
			if (isSectionLine(line)) continue;
			for (const token of tokenizeChordsLine(line)) {
				if (token.type !== "bracket") continue;
				const name = token.value.slice(1, -1);
				if (!FRET_STRING_RE.test(name)) seen.add(name);
			}
		}
		return [...seen];
	}

	private renderDiagram(container: HTMLElement, name: string): void {
		const group = container.createDiv({
			cls: "chords-notation-diagram-group",
		});
		const guitar = this.customDefs.get(name) ?? lookupChord(name);
		if (guitar) renderGuitarDiagram(group, guitar);

		const piano = lookupPianoChord(name);
		if (piano) renderPianoDiagram(group, piano);
	}

	render(source: string): void {
		this.el.addClass("chords-notation-block");
		this.customDefs = parseCustomChordDefs(source);

		const names = this.chordNames(source);
		if (names.length > 0) {
			const diagrams = this.el.createDiv({
				cls: "chords-notation-diagrams",
			});
			for (const name of names) this.renderDiagram(diagrams, name);
		}

		const controls = this.el.createDiv({
			cls: "chords-notation-controls",
		});
		controls.createSpan({
			cls: "chords-transpose-label",
			text: "Transpose",
		});
		const btnDown = controls.createEl("button", {
			cls: "chords-transpose-btn",
			text: "−1",
		});
		const btnUp = controls.createEl("button", {
			cls: "chords-transpose-btn",
			text: "+1",
		});
		btnDown.addEventListener("click", () => this.applyTranspose(-1));
		btnUp.addEventListener("click", () => this.applyTranspose(1));

		const contentEl = this.el.createDiv({ cls: "chords-notation-content" });
		for (const line of splitChordsLines(source))
			this.renderLine(contentEl, line);
	}
}

export function registerChordsPackage(plugin: Plugin): void {
	plugin.registerMarkdownCodeBlockProcessor("chords", (source, el, ctx) => {
		new ChordsBlockRenderer(plugin, el, ctx).render(source);
	});
}
