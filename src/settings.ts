import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

export interface ProgressionPackageSettings {
	enabled: boolean;
}

export interface StrummingPackageSettings {
	enabled: boolean;
}

export interface AbcPackageSettings {
	enabled: boolean;
	staffWidth: number;
	scale: number;
	instrument: number;
}

export interface ChordsPackageSettings {
	enabled: boolean;
	defaultExpandTools: boolean;
}

export interface MidiCapturePackageSettings {
	enabled: boolean;
	bpm: number;
}

export interface SheetMusicSettings {
	packages: {
		progression: ProgressionPackageSettings;
		strumming: StrummingPackageSettings;
		abc: AbcPackageSettings;
		chords: ChordsPackageSettings;
		midiCapture: MidiCapturePackageSettings;
	};
}

type ConfigurablePlugin = Plugin & {
	settings: SheetMusicSettings;
	saveSettings(): Promise<void>;
};

export const DEFAULT_SETTINGS: SheetMusicSettings = {
	packages: {
		progression: {
			enabled: true,
		},
		strumming: {
			enabled: true,
		},
		abc: {
			enabled: true,
			staffWidth: 740,
			scale: 1,
			instrument: 0,
		},
		chords: {
			enabled: true,
			defaultExpandTools: false,
		},
		midiCapture: {
			enabled: true,
			bpm: 120,
		},
	},
};

function parsePositiveNumber(
	value: string,
	fallback: number,
	minimum: number,
): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < minimum) {
		return fallback;
	}

	return parsed;
}

export class SheetMusicSettingTab extends PluginSettingTab {
	plugin: ConfigurablePlugin;

	constructor(app: App, plugin: ConfigurablePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		new Setting(containerEl).setName("Packages").setHeading();

		new Setting(containerEl)
			.setName("Enable progression package")
			.setDesc("Registers the progression code block processor.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.packages.progression.enabled)
					.onChange(async (value) => {
						this.plugin.settings.packages.progression.enabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Enable strumming package")
			.setDesc("Registers the strumming code block processor.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.packages.strumming.enabled)
					.onChange(async (value) => {
						this.plugin.settings.packages.strumming.enabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("ABC notation").setHeading();

		new Setting(containerEl)
			.setName("Enable ABC package")
			.setDesc("Registers the ABC code block processor.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.packages.abc.enabled)
					.onChange(async (value) => {
						this.plugin.settings.packages.abc.enabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("ABC staff width")
			.setDesc("Preferred notation width in pixels.")
			.addText((text) => {
				text.setPlaceholder(
					String(DEFAULT_SETTINGS.packages.abc.staffWidth),
				);
				text.setValue(
					String(this.plugin.settings.packages.abc.staffWidth),
				);
				text.inputEl.type = "number";
				text.inputEl.min = "240";
				text.onChange(async (value) => {
					this.plugin.settings.packages.abc.staffWidth =
						parsePositiveNumber(
							value,
							DEFAULT_SETTINGS.packages.abc.staffWidth,
							240,
						);
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("ABC scale")
			.setDesc("Notation scale multiplier.")
			.addText((text) => {
				text.setPlaceholder(
					String(DEFAULT_SETTINGS.packages.abc.scale),
				);
				text.setValue(String(this.plugin.settings.packages.abc.scale));
				text.inputEl.type = "number";
				text.inputEl.min = "0.5";
				text.inputEl.max = "2";
				text.inputEl.step = "0.1";
				text.onChange(async (value) => {
					this.plugin.settings.packages.abc.scale =
						parsePositiveNumber(
							value,
							DEFAULT_SETTINGS.packages.abc.scale,
							0.5,
						);
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("ABC instrument")
			.setDesc("MIDI program number (0-127) used for ABC playback.")
			.addText((text) => {
				text.setPlaceholder(
					String(DEFAULT_SETTINGS.packages.abc.instrument),
				);
				text.setValue(
					String(this.plugin.settings.packages.abc.instrument),
				);
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.max = "127";
				text.inputEl.step = "1";
				text.onChange(async (value) => {
					const parsed = parsePositiveNumber(
						value,
						DEFAULT_SETTINGS.packages.abc.instrument,
						0,
					);
					this.plugin.settings.packages.abc.instrument = Math.min(
						Math.max(Math.round(parsed), 0),
						127,
					);
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setName("Chord sheet notation").setHeading();

		new Setting(containerEl)
			.setName("Enable chords package")
			.setDesc("Registers the chords code block processor.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.packages.chords.enabled)
					.onChange(async (value) => {
						this.plugin.settings.packages.chords.enabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Expand chord tools by default")
			.setDesc(
				"When enabled, chord diagrams and transpose controls are visible by default. Otherwise they are collapsed behind a toggle.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.packages.chords.defaultExpandTools,
					)
					.onChange(async (value) => {
						this.plugin.settings.packages.chords.defaultExpandTools =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("MIDI capture").setHeading();

		new Setting(containerEl)
			.setName("Enable MIDI capture")
			.setDesc(
				"Registers the 'Start / Stop MIDI capture' commands for live piano transcription.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.packages.midiCapture.enabled,
					)
					.onChange(async (value) => {
						this.plugin.settings.packages.midiCapture.enabled =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Capture BPM")
			.setDesc(
				"Tempo used to quantize captured note durations into ABC notation.",
			)
			.addText((text) => {
				text.setPlaceholder(
					String(DEFAULT_SETTINGS.packages.midiCapture.bpm),
				);
				text.setValue(
					String(this.plugin.settings.packages.midiCapture.bpm),
				);
				text.inputEl.type = "number";
				text.inputEl.min = "20";
				text.inputEl.max = "300";
				text.inputEl.step = "1";
				text.onChange(async (value) => {
					this.plugin.settings.packages.midiCapture.bpm =
						parsePositiveNumber(
							value,
							DEFAULT_SETTINGS.packages.midiCapture.bpm,
							20,
						);
					await this.plugin.saveSettings();
				});
			});
	}
}
