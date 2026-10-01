import { Plugin } from "obsidian";
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
import { CHORDS_VIEW_TYPE, ChordsView, openChordsView } from "./chords-view";

class ChordsBlockRenderer {
	private readonly el: HTMLElement;

	constructor(el: HTMLElement) {
		this.el = el;
	}

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

	render(source: string): void {
		this.el.addClass("chords-notation-block");
		const contentEl = this.el.createDiv({ cls: "chords-notation-content" });
		for (const line of splitChordsLines(source))
			this.renderLine(contentEl, line);
	}
}

export function registerChordsPackage(plugin: Plugin): void {
	applyTranslationsClass(plugin);
	plugin.register(() => document.body.removeClass(TRANSLATIONS_HIDDEN_CLASS));
	registerTranslateCommands(plugin);
	plugin.registerMarkdownCodeBlockProcessor("chords", (source, el) => {
		new ChordsBlockRenderer(el).render(source);
	});

	plugin.registerView(CHORDS_VIEW_TYPE, (leaf) => new ChordsView(leaf, plugin));
	plugin.addRibbonIcon("guitar", "Open chords pane", () => {
		void openChordsView(plugin);
	});
	plugin.addCommand({
		id: "open-chords-pane",
		name: "Open chords pane",
		callback: () => {
			void openChordsView(plugin);
		},
	});
}
