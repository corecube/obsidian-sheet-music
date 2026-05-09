import { Plugin } from "obsidian";
import { registerAbcPackage } from "./abc";
import { registerAutoscrollFeature } from "./autoscroll";
import { registerChordsPackage } from "./chords";
import { registerMusicXmlPackage, registerMusicXmlFileView } from "./musicxml";
import { registerStrummingPackage } from "./strumming";
import {
	DEFAULT_SETTINGS,
	SheetMusicSettingTab,
	SheetMusicSettings,
} from "./settings";

export default class SheetMusicPlugin extends Plugin {
	settings!: SheetMusicSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SheetMusicSettingTab(this.app, this));

		if (this.settings.packages.strumming.enabled) {
			registerStrummingPackage(this);
		}

		if (this.settings.packages.abc.enabled) {
			registerAbcPackage(this);
		}

		if (this.settings.packages.musicxml.enabled) {
			registerMusicXmlPackage(this);
			registerMusicXmlFileView(this);
		}

		if (this.settings.packages.chords.enabled) {
			registerChordsPackage(this);
		}

		registerAutoscrollFeature(this);
	}

	async loadSettings() {
		const stored =
			(await this.loadData()) as Partial<SheetMusicSettings> | null;

		this.settings = {
			packages: {
				strumming: {
					...DEFAULT_SETTINGS.packages.strumming,
					...stored?.packages?.strumming,
				},
				abc: {
					...DEFAULT_SETTINGS.packages.abc,
					...stored?.packages?.abc,
				},
				musicxml: {
					...DEFAULT_SETTINGS.packages.musicxml,
					...stored?.packages?.musicxml,
				},
				chords: {
					...DEFAULT_SETTINGS.packages.chords,
					...stored?.packages?.chords,
				},
			},
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
