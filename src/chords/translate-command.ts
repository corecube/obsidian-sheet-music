import { Notice, Plugin, setIcon } from "obsidian";
import type SheetMusicPlugin from "../main";
import {
	collectTranslatableLines,
	findChordsBlocks,
	insertTranslations,
	type ChordsBlock,
	type TranslatableLine,
} from "./translate-logic";
import { translateLines } from "./translate-service";

interface BlockWorkItem {
	block: ChordsBlock;
	source: string;
	entries: TranslatableLine[];
	translations: string[];
}

export function registerTranslateRibbon(plugin: Plugin): void {
	let running = false;

	const btn = plugin.addRibbonIcon(
		"languages",
		"Translate chord blocks in active note",
		() => {
			void run();
		},
	);

	async function run(): Promise<void> {
		if (running) return;
		const file = plugin.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active note.");
			return;
		}

		const data = await plugin.app.vault.read(file);
		const lines = data.split("\n");
		const blocks = findChordsBlocks(lines);
		if (blocks.length === 0) {
			new Notice("No chords blocks in this note.");
			return;
		}

		const items: BlockWorkItem[] = [];
		for (const block of blocks) {
			const source = lines.slice(block.start + 1, block.end).join("\n");
			const entries = collectTranslatableLines(source);
			if (entries.length > 0) {
				items.push({ block, source, entries, translations: [] });
			}
		}
		if (items.length === 0) {
			new Notice("No lyric lines to translate.");
			return;
		}

		const chordsPlugin = plugin as SheetMusicPlugin;
		const lang =
			chordsPlugin.settings.packages.chords.translateTargetLanguage;

		running = true;
		setIcon(btn, "loader");
		btn.toggleClass("is-active", true);
		try {
			const allTexts = items.flatMap((item) =>
				item.entries.map((entry) => entry.text),
			);
			const translations = await translateLines(allTexts, lang);

			let offset = 0;
			for (const item of items) {
				item.translations = translations.slice(
					offset,
					offset + item.entries.length,
				);
				offset += item.entries.length;
			}

			let conflict = false;
			await plugin.app.vault.process(file, (current) => {
				if (current !== data) {
					conflict = true;
					return current;
				}
				const out = current.split("\n");
				for (const item of [...items].reverse()) {
					out.splice(
						item.block.start + 1,
						item.block.end - item.block.start - 1,
						...insertTranslations(
							item.source,
							item.entries,
							item.translations,
						).split("\n"),
					);
				}
				return out.join("\n");
			});
			if (conflict) {
				new Notice("Note changed during translation; aborted.");
				return;
			}
			new Notice(
				`Translated ${allTexts.length} lines in ${items.length} chord blocks.`,
			);
		} catch (error) {
			console.error("Sheet music: translation failed", error);
			new Notice(
				"Translation failed: " +
					(error instanceof Error ? error.message : String(error)),
			);
		} finally {
			running = false;
			setIcon(btn, "languages");
			btn.toggleClass("is-active", false);
		}
	}
}
