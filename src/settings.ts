import {
	App,
	Plugin,
	PluginSettingTab,
	type SettingDefinitionItem,
} from "obsidian";

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
	translateTargetLanguage: string;
	showTranslations: boolean;
}

export interface PianoMonitorPackageSettings {
	enabled: boolean;
}

export interface MidiCapturePackageSettings {
	enabled: boolean;
}

export interface SheetMusicSettings {
	packages: {
		progression: ProgressionPackageSettings;
		strumming: StrummingPackageSettings;
		abc: AbcPackageSettings;
		chords: ChordsPackageSettings;
		midiCapture: MidiCapturePackageSettings;
		pianoMonitor: PianoMonitorPackageSettings;
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
			translateTargetLanguage: "en",
			showTranslations: true,
		},
		midiCapture: {
			enabled: true,
		},
		pianoMonitor: {
			enabled: true,
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

	getSettingDefinitions(): SettingDefinitionItem[] {
		const abc = DEFAULT_SETTINGS.packages.abc;
		return [
			{
				type: "group",
				heading: "Packages",
				items: [
					{
						name: "Enable progression package",
						desc: "Registers the progression code block processor.",
						control: {
							type: "toggle",
							key: "packages.progression.enabled",
						},
					},
					{
						name: "Enable strumming package",
						desc: "Registers the strumming code block processor.",
						control: {
							type: "toggle",
							key: "packages.strumming.enabled",
						},
					},
				],
			},
			{
				type: "group",
				heading: "ABC notation",
				items: [
					{
						name: "Enable ABC package",
						desc: "Registers the ABC code block processor.",
						control: {
							type: "toggle",
							key: "packages.abc.enabled",
						},
					},
					{
						name: "ABC staff width",
						desc: "Preferred notation width in pixels.",
						control: {
							type: "number",
							key: "packages.abc.staffWidth",
							defaultValue: abc.staffWidth,
							placeholder: String(abc.staffWidth),
							min: 240,
							step: 1,
							validate: (value) => {
								if (!Number.isFinite(value) || value < 240) {
									return "Enter a number of at least 240.";
								}
								return undefined;
							},
						},
					},
					{
						name: "ABC scale",
						desc: "Notation scale multiplier.",
						control: {
							type: "number",
							key: "packages.abc.scale",
							defaultValue: abc.scale,
							placeholder: String(abc.scale),
							min: 0.5,
							max: 2,
							step: 0.1,
							validate: (value) => {
								if (!Number.isFinite(value) || value < 0.5) {
									return "Enter a number of at least 0.5.";
								}
								return undefined;
							},
						},
					},
					{
						name: "ABC instrument",
						desc: "MIDI program number (0-127) used for ABC playback.",
						control: {
							type: "number",
							key: "packages.abc.instrument",
							defaultValue: abc.instrument,
							placeholder: String(abc.instrument),
							min: 0,
							max: 127,
							step: 1,
							validate: (value) => {
								if (
									!Number.isInteger(value) ||
									value < 0 ||
									value > 127
								) {
									return "Enter a whole number between 0 and 127.";
								}
								return undefined;
							},
						},
					},
				],
			},
			{
				type: "group",
				heading: "Chord sheet notation",
				items: [
					{
						name: "Enable chords package",
						desc: "Registers the chords code block processor.",
						control: {
							type: "toggle",
							key: "packages.chords.enabled",
						},
					},
					{
						name: "Expand chord tools by default",
						desc: "When enabled, chord diagrams and transpose controls are visible by default. Otherwise they are collapsed behind a toggle.",
						control: {
							type: "toggle",
							key: "packages.chords.defaultExpandTools",
						},
					},
					{
						name: "Translation target language",
						desc: 'ISO language code (e.g. "en", "de", "es") used by the Translate button in chord blocks.',
						control: {
							type: "text",
							key: "packages.chords.translateTargetLanguage",
							defaultValue:
								DEFAULT_SETTINGS.packages.chords
									.translateTargetLanguage,
							placeholder: "en",
						},
					},
				],
			},
			{
				type: "group",
				heading: "MIDI capture",
				items: [
					{
						name: "Enable MIDI capture",
						desc: "Registers the 'Start / Stop MIDI capture' commands for live piano transcription.",
						control: {
							type: "toggle",
							key: "packages.midiCapture.enabled",
						},
					},
				],
			},
			{
				type: "group",
				heading: "Piano monitor",
				items: [
					{
						name: "Enable piano monitor",
						desc: "Registers the piano monitor sidebar view command.",
						control: {
							type: "toggle",
							key: "packages.pianoMonitor.enabled",
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		return key
			.split(".")
			.reduce<unknown>(
				(obj, part) =>
					(obj as Record<string, unknown> | undefined)?.[part],
				this.plugin.settings,
			);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const parts = key.split(".");
		const last = parts.pop();
		if (!last) return;
		let target = this.plugin.settings as unknown as Record<
			string,
			unknown
		>;
		for (const part of parts) {
			target = target[part] as Record<string, unknown>;
		}
		target[last] = this.coerceControlValue(key, value);
		await this.plugin.saveSettings();
	}

	private coerceControlValue(key: string, value: unknown): unknown {
		switch (key) {
			case "packages.abc.staffWidth":
				return parsePositiveNumber(
					String(value),
					DEFAULT_SETTINGS.packages.abc.staffWidth,
					240,
				);
			case "packages.abc.scale":
				return parsePositiveNumber(
					String(value),
					DEFAULT_SETTINGS.packages.abc.scale,
					0.5,
				);
			case "packages.abc.instrument": {
				const parsed = parsePositiveNumber(
					String(value),
					DEFAULT_SETTINGS.packages.abc.instrument,
					0,
				);
				return Math.min(Math.max(Math.round(parsed), 0), 127);
			}
			case "packages.chords.translateTargetLanguage": {
				const lang = String(value).trim().toLowerCase();
				return (
					lang ||
					DEFAULT_SETTINGS.packages.chords.translateTargetLanguage
				);
			}
			default:
				return value;
		}
	}
}
