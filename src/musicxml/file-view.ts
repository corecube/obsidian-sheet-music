import { FileView, WorkspaceLeaf, TFile } from "obsidian";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type SheetMusicPlugin from "../main";
import { normalizeMusicXmlZoom, parseMusicXmlBlock } from "./renderer-logic";

export const MUSICXML_VIEW_TYPE = "musicxml";

export class MusicXmlFileView extends FileView {
	plugin!: SheetMusicPlugin;
	osmd: OpenSheetMusicDisplay | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return MUSICXML_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "MusicXML";
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("musicxml-file-view");

		try {
			const content = (await this.app.vault.read(file)).trim();
			const model = parseMusicXmlBlock(content);

			if (!model) {
				this.contentEl.createEl("p", {
					text: "Invalid notation file. Add valid musicxml markup.",
					cls: "musicxml-notation-error",
				});
				return;
			}

			const notationEl = this.contentEl.createDiv({
				cls: "musicxml-notation-sheet",
			});

			this.osmd = new OpenSheetMusicDisplay(notationEl, {
				autoResize: true,
				drawTitle: true,
			});

			this.osmd.zoom = normalizeMusicXmlZoom(
				this.plugin.settings.packages.musicxml,
			);
			await this.osmd.load(model.source);
			this.osmd.render();
		} catch (error) {
			this.contentEl.createEl("p", {
				text: `Failed to render notation: ${String(error)}`,
				cls: "musicxml-notation-error",
			});
		}
	}

	async onClose(): Promise<void> {
		this.osmd = null;
	}
}

export function registerMusicXmlFileView(plugin: SheetMusicPlugin): void {
	plugin.registerView(MUSICXML_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
		const view = new MusicXmlFileView(leaf);
		view.plugin = plugin;
		return view;
	});

	plugin.registerExtensions(["musicxml"], MUSICXML_VIEW_TYPE);
}
