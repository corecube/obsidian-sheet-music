import type { AbcVisualParams, ClickListener } from "abcjs";
import type { AbcPackageSettings } from "../settings";
import { clampNumber, clampTransposeSemitones } from "../utils/clamp";

export interface AbcBlockModel {
	source: string;
	title: string | null;
	ariaLabel: string;
	customRenderOptions: Record<string, unknown>;
	customRenderOptionsError: string | null;
}

interface ExtractedCustomOptions {
	abcSource: string;
	customRenderOptions: Record<string, unknown>;
	customRenderOptionsError: string | null;
}


function extractCustomRenderOptions(source: string): ExtractedCustomOptions {
	const lines = source.split("\n");
	const separatorLine = lines.findIndex((line) => line.trim() === "---");
	if (separatorLine <= 0) {
		return {
			abcSource: source,
			customRenderOptions: {},
			customRenderOptionsError: null,
		};
	}

	const headerText = lines.slice(0, separatorLine).join("\n");
	const abcSource = lines.slice(separatorLine + 1).join("\n");
	if (!headerText.trimStart().startsWith("{")) {
		return {
			abcSource: source,
			customRenderOptions: {},
			customRenderOptionsError: null,
		};
	}

	try {
		const parsed: unknown = JSON.parse(headerText);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {
				abcSource,
				customRenderOptions: {},
				customRenderOptionsError:
					"Custom options must be a JSON object.",
			};
		}

		return {
			abcSource,
			customRenderOptions: parsed as Record<string, unknown>,
			customRenderOptionsError: null,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Invalid JSON";
		return {
			abcSource,
			customRenderOptions: {},
			customRenderOptionsError: `Invalid custom options JSON: ${errorMessage}`,
		};
	}
}

export function parseAbcBlock(source: string): AbcBlockModel | null {
	const extracted = extractCustomRenderOptions(source);
	const trimmed = extracted.abcSource.trim();
	if (trimmed.length === 0 || !/^K\s*:/m.test(trimmed)) {
		return null;
	}

	const normalizedSource = /^X\s*:/m.test(trimmed)
		? trimmed
		: `X:1\n${trimmed}`;
	const title =
		normalizedSource.match(/^T\s*:\s*(.+)$/m)?.[1]?.trim() ?? null;

	return {
		source: normalizedSource,
		title,
		ariaLabel: title ? `ABC notation for ${title}` : "ABC notation",
		customRenderOptions: extracted.customRenderOptions,
		customRenderOptionsError: extracted.customRenderOptionsError,
	};
}

export function buildAbcRenderOptions(
	settings: AbcPackageSettings,
	ariaLabel: string,
	transposeSemitones = 0,
	clickListener?: ClickListener,
	customRenderOptions: Record<string, unknown> = {},
): AbcVisualParams {
	const options = {
		add_classes: true,
		ariaLabel,
		clickListener,
		responsive: "resize",
		scale: clampNumber(settings.scale, 1, 0.5, 2),
		staffwidth: clampNumber(settings.staffWidth, 740, 240, 2400),
		visualTranspose: clampTransposeSemitones(transposeSemitones),
		...customRenderOptions,
	} as AbcVisualParams;

	options.ariaLabel = ariaLabel;
	options.clickListener = clickListener;
	options.visualTranspose = clampTransposeSemitones(transposeSemitones);
	return options;
}
