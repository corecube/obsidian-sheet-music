import type { Plugin } from "obsidian";
import type SheetMusicPlugin from "../main";

/** Body class that hides every chord-sheet translation line via CSS. */
export const TRANSLATIONS_HIDDEN_CLASS = "sheet-music-hide-translations";

const listeners = new Set<() => void>();

export function areTranslationsVisible(plugin: Plugin): boolean {
	return (plugin as SheetMusicPlugin).settings.packages.chords
		.showTranslations;
}

export function setTranslationsVisible(plugin: Plugin, visible: boolean): void {
	const chordsPlugin = plugin as SheetMusicPlugin;
	chordsPlugin.settings.packages.chords.showTranslations = visible;
	applyTranslationsClass(plugin);
	void chordsPlugin.saveSettings();
	for (const cb of listeners) cb();
}

export function toggleTranslations(plugin: Plugin): void {
	setTranslationsVisible(plugin, !areTranslationsVisible(plugin));
}

/** Sync the body class with the persisted setting (no save, no notify). */
export function applyTranslationsClass(plugin: Plugin): void {
	document.body.toggleClass(
		TRANSLATIONS_HIDDEN_CLASS,
		!areTranslationsVisible(plugin),
	);
}

/** Subscribe to visibility changes; returns an unsubscribe function. */
export function onTranslationsChanged(cb: () => void): () => void {
	listeners.add(cb);
	return () => {
		listeners.delete(cb);
	};
}
