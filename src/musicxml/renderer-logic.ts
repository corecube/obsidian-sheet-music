import type { MusicXmlPackageSettings } from "../settings";
import { clampNumber } from "../utils/clamp";

export interface MusicXmlBlockModel {
	source: string;
}

export function parseMusicXmlBlock(source: string): MusicXmlBlockModel | null {
	const trimmed = source.trim();

	if (
		trimmed.length === 0 ||
		(!trimmed.includes("<score-partwise") &&
			!trimmed.includes("<score-timewise"))
	) {
		return null;
	}

	return {
		source: trimmed,
	};
}

export function normalizeMusicXmlZoom(
	settings: MusicXmlPackageSettings,
): number {
	return clampNumber(settings.zoom, 1, 0.5, 2);
}
