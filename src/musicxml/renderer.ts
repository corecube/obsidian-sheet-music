import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { Plugin } from "obsidian";
import type SheetMusicPlugin from "../main";
import { normalizeMusicXmlZoom, parseMusicXmlBlock } from "./renderer-logic";

function renderInvalidMusicXmlBlock(el: HTMLElement): void {
	el.createEl("p", {
		text: "Invalid notation block. Add valid musicxml markup.",
		cls: "musicxml-notation-error",
	});
}

export function registerMusicXmlPackage(plugin: Plugin): void {
	plugin.registerMarkdownCodeBlockProcessor("musicxml", (source, el) => {
		const model = parseMusicXmlBlock(source);
		if (!model) {
			renderInvalidMusicXmlBlock(el);
			return;
		}

		const musicXmlPlugin = plugin as SheetMusicPlugin;
		const notationEl = el.createDiv({ cls: "musicxml-notation-sheet" });
		el.addClass("musicxml-notation-block");

		void (async () => {
			try {
				const osmd = new OpenSheetMusicDisplay(notationEl, {
					autoResize: true,
					drawTitle: true,
					drawingParameters: "compacttight",
				});

				osmd.zoom = normalizeMusicXmlZoom(
					musicXmlPlugin.settings.packages.musicxml,
				);
				await osmd.load(model.source);
				osmd.render();
			} catch {
				notationEl.remove();
				renderInvalidMusicXmlBlock(el);
			}
		})();
	});
}
