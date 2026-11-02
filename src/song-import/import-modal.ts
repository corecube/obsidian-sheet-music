import {
	type ButtonComponent,
	Modal,
	normalizePath,
	Notice,
	Plugin,
	requestUrl,
	Setting,
	TextAreaComponent,
} from "obsidian";
import type SheetMusicPlugin from "../main";
import type { SongImportPackageSettings } from "../settings";
import { withTimeout } from "../utils/with-timeout";
import {
	buildNote,
	looksLikeUrl,
	nextAvailablePath,
	sheetToLines,
	songFromPastedText,
} from "./import-logic";
import type { ImportedSong, SongSource } from "./song";
import { findSource, SOURCES } from "./sources";

const REQUEST_TIMEOUT_MS = 20000;

async function fetchPage(source: SongSource, url: string): Promise<string> {
	const res = await withTimeout(
		requestUrl({ url, throw: false }),
		REQUEST_TIMEOUT_MS,
		`${source.name} request timed out`,
	);
	console.debug(
		"Sheet music: song import fetched",
		url,
		"status",
		res.status,
		"bytes",
		res.text.length,
	);
	if (res.status >= 400) {
		throw new Error(
			`${source.name} responded with HTTP ${res.status}. ` +
				"Copy the chord text from your browser and paste it instead.",
		);
	}
	return res.text;
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

export class SongImportModal extends Modal {
	private input!: TextAreaComponent;
	private status!: HTMLElement;
	private button!: ButtonComponent;
	private running = false;

	constructor(private readonly plugin: Plugin) {
		super(plugin.app);
	}

	onOpen(): void {
		this.setTitle("Import song");
		this.contentEl.addClass("song-import-modal");
		const sites = SOURCES.map((source) => source.name).join(", ");
		this.contentEl.createEl("p", {
			text: `Paste a link to a chord page (${sites}), or chords-over-lyrics text copied from any site.`,
		});
		this.input = new TextAreaComponent(this.contentEl).setPlaceholder(
			"Link or chord text",
		);
		this.input.inputEl.addClass("song-import-input");
		this.input.inputEl.rows = 12;
		this.status = this.contentEl.createDiv({ cls: "song-import-status" });
		new Setting(this.contentEl).addButton((button) => {
			this.button = button;
			button
				.setButtonText("Import")
				.setCta()
				.onClick(() => {
					void this.run();
				});
		});
		this.scope.register(["Mod"], "Enter", () => {
			void this.run();
			return false;
		});
		this.input.inputEl.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private settings(): SongImportPackageSettings {
		return (this.plugin as SheetMusicPlugin).settings.packages.songImport;
	}

	private async resolveSong(input: string): Promise<ImportedSong> {
		if (!looksLikeUrl(input)) return songFromPastedText(input);
		const source = findSource(input);
		if (!source) {
			throw new Error(
				`Links from ${hostOf(input)} are not supported yet. Paste the chord text instead.`,
			);
		}
		this.status.setText(`Fetching page from ${source.name}…`);
		const result = source.extract(await fetchPage(source, input), input);
		if (!result.ok) {
			if (result.debug !== undefined) {
				console.debug("Sheet music: song import", source.id, result.debug);
			}
			throw new Error(result.message);
		}
		return result.song;
	}

	private async run(): Promise<void> {
		if (this.running) return;
		const input = this.input.getValue().trim();
		if (!input) {
			new Notice("Paste a link or chord text first.");
			return;
		}

		this.running = true;
		this.button.setDisabled(true).setButtonText("Importing…");
		try {
			const song = await this.resolveSong(input);

			this.status.setText("Converting…");
			const lines = sheetToLines(song.sheet, this.settings());
			const { fileName, content } = buildNote({ song, lines });
			const folder =
				this.plugin.app.workspace.getActiveFile()?.parent?.path ?? "";
			const path = nextAvailablePath(
				folder,
				fileName,
				(candidate) =>
					this.plugin.app.vault.getAbstractFileByPath(
						normalizePath(candidate),
					) !== null,
			);
			const file = await this.plugin.app.vault.create(
				normalizePath(path),
				content,
			);
			await this.plugin.app.workspace.getLeaf().openFile(file);
			new Notice(`Imported "${file.basename}".`);
			this.close();
		} catch (error) {
			console.error("Sheet music: song import failed", error);
			new Notice(
				"Import failed: " +
					(error instanceof Error ? error.message : String(error)),
			);
		} finally {
			this.running = false;
			this.status.setText("");
			this.button.setDisabled(false).setButtonText("Import");
		}
	}
}
