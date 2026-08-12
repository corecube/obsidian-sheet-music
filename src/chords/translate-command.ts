import { Notice, Plugin, setIcon, TFile } from "obsidian";
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

interface FileTranslationResult {
	lines: number;
	blocks: number;
	conflict: boolean;
}

const BULK_FILE_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateFileBlocks(
	plugin: Plugin,
	file: TFile,
	lang: string,
): Promise<FileTranslationResult | null> {
	const data = await plugin.app.vault.read(file);
	const lines = data.split("\n");
	const blocks = findChordsBlocks(lines);
	if (blocks.length === 0) return null;

	const items: BlockWorkItem[] = [];
	for (const block of blocks) {
		const source = lines.slice(block.start + 1, block.end).join("\n");
		const entries = collectTranslatableLines(source);
		if (entries.length > 0) {
			items.push({ block, source, entries, translations: [] });
		}
	}
	if (items.length === 0) return null;

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

	return { lines: allTexts.length, blocks: items.length, conflict };
}

export function registerTranslateCommands(plugin: Plugin): void {
	let running = false;

	const targetLanguage = (): string =>
		(plugin as SheetMusicPlugin).settings.packages.chords
			.translateTargetLanguage;

	const btn = plugin.addRibbonIcon(
		"languages",
		"Translate chord blocks in active note",
		() => {
			void runActiveNote();
		},
	);

	plugin.addCommand({
		id: "translate-vault-chords",
		name: "Translate chord blocks in all notes",
		callback: () => {
			void runVault();
		},
	});

	async function runActiveNote(): Promise<void> {
		if (running) return;
		const file = plugin.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active note.");
			return;
		}

		running = true;
		setIcon(btn, "loader");
		btn.toggleClass("is-active", true);
		try {
			const result = await translateFileBlocks(
				plugin,
				file,
				targetLanguage(),
			);
			if (!result) {
				new Notice("No chord lyrics to translate in this note.");
			} else if (result.conflict) {
				new Notice("Note changed during translation; aborted.");
			} else {
				new Notice(
					`Translated ${result.lines} lines in ${result.blocks} chord blocks.`,
				);
			}
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

	async function runVault(): Promise<void> {
		if (running) return;
		running = true;
		const files = plugin.app.vault.getMarkdownFiles();
		const progress = new Notice("Translating chord blocks…", 0);
		let notes = 0;
		let lines = 0;
		let conflicts = 0;
		try {
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				if (!file) continue;
				progress.setMessage(
					`Translating chord blocks… ${i + 1}/${files.length} notes`,
				);
				let result: FileTranslationResult | null;
				try {
					result = await translateFileBlocks(
						plugin,
						file,
						targetLanguage(),
					);
				} catch (error) {
					console.error("Sheet music: translation failed", error);
					new Notice(
						`Translation stopped at "${file.basename}": ` +
							(error instanceof Error
								? error.message
								: String(error)) +
							" — run the command again to continue.",
					);
					return;
				}
				if (!result) continue;
				if (result.conflict) {
					conflicts++;
					continue;
				}
				notes++;
				lines += result.lines;
				await sleep(BULK_FILE_DELAY_MS);
			}
			new Notice(
				`Translated ${lines} lines in ${notes} notes.` +
					(conflicts > 0
						? ` Skipped ${conflicts} notes changed during translation.`
						: ""),
			);
		} finally {
			progress.hide();
			running = false;
		}
	}
}
