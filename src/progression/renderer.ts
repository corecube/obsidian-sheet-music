import { Plugin } from "obsidian";
import { parseProgression } from "./renderer-logic";

export function registerProgressionPackage(plugin: Plugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"progression",
		(source, el) => {
			const model = parseProgression(source);
			if (!model) {
				el.createEl("p", {
					cls: "progression-error",
					text: "Add a key as the first line (e.g. C or Am).",
				});
				return;
			}

			el.createEl("small", { text: `Key: ${model.key}` });

			const table = el.createEl("table");
			for (const row of model.rows) {
				const numeralRow = table.createEl("tr");
				const chordRow = table.createEl("tr");
				for (const item of row) {
					numeralRow.createEl("td").createEl("em", { text: item.numeral });
					chordRow.createEl("td").createEl("strong", { text: item.chord });
				}
			}
		},
	);
}
