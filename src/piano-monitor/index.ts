import { Plugin } from "obsidian";
import { PIANO_MONITOR_VIEW_TYPE, PianoMonitorView } from "./view";

export { PIANO_MONITOR_VIEW_TYPE };

export function registerPianoMonitorPackage(plugin: Plugin): void {
	plugin.registerView(
		PIANO_MONITOR_VIEW_TYPE,
		(leaf) => new PianoMonitorView(leaf),
	);
	plugin.addCommand({
		id: "open-piano-monitor",
		name: "Open piano monitor",
		callback: async () => {
			const existing =
				plugin.app.workspace.getLeavesOfType(PIANO_MONITOR_VIEW_TYPE);
			const first = existing[0];
			if (first) {
				void plugin.app.workspace.revealLeaf(first);
				return;
			}
			const leaf = plugin.app.workspace.getRightLeaf(false);
			await leaf?.setViewState({
				type: PIANO_MONITOR_VIEW_TYPE,
				active: true,
			});
			if (leaf) void plugin.app.workspace.revealLeaf(leaf);
		},
	});
}
