import { Plugin } from "obsidian";
import { SongImportModal } from "./import-modal";

export function registerSongImportPackage(plugin: Plugin): void {
	plugin.addCommand({
		id: "import-song",
		name: "Import song from link or text",
		callback: () => {
			new SongImportModal(plugin).open();
		},
	});
}
