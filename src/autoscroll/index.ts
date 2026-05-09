import {
	MarkdownView,
	Plugin,
	setIcon,
	TFile,
	type WorkspaceLeaf,
} from "obsidian";
import {
	calculateAutoscrollInterval,
	DEFAULT_AUTOSCROLL_SPEED,
	parseAutoscrollSpeed,
} from "./logic";

const AUTOSCROLL_SPEED_KEY = "autoscroll-speed";

class MarkdownAutoscrollController {
	private buttonEl: HTMLElement;
	private isRunning = false;
	private intervalId: number | null = null;
	private speed = DEFAULT_AUTOSCROLL_SPEED;

	constructor(
		private readonly plugin: Plugin,
		private readonly leaf: WorkspaceLeaf,
		private readonly view: MarkdownView,
	) {
		this.buttonEl = this.view.addAction(
			"scroll-text",
			"Toggle auto scroll",
			() => this.toggle(),
		);
		this.buttonEl.addClass("sheet-music-autoscroll-toggle");
		this.refreshButtonState();
	}

	destroy(): void {
		this.stop();
		this.buttonEl.remove();
	}

	stop(): void {
		if (!this.isRunning) {
			return;
		}

		this.isRunning = false;
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.refreshButtonState();
	}

	private toggle(): void {
		if (this.isRunning) {
			this.stop();
			return;
		}

		if (!this.isPreviewMode()) {
			this.refreshButtonState();
			return;
		}

		if (!this.getScrollElement()) {
			return;
		}

		this.speed = this.getAutoscrollSpeedForFile(this.view.file);
		this.isRunning = true;
		this.refreshButtonState();
		this.startInterval();
	}

	private startInterval(): void {
		const interval = calculateAutoscrollInterval(this.speed);
		this.intervalId = window.setInterval(() => {
			if (!this.isRunning || !this.isPreviewMode()) {
				this.stop();
				return;
			}

			const scrollEl = this.getScrollElement();
			if (!scrollEl) {
				this.stop();
				return;
			}

			scrollEl.scrollBy(0, 1);
			if (this.hasReachedBottom(scrollEl)) {
				this.stop();
			}
		}, interval);
	}

	private hasReachedBottom(scrollEl: HTMLElement): boolean {
		const maxScrollTop = scrollEl.scrollHeight - scrollEl.clientHeight;
		if (maxScrollTop <= 0) {
			return false;
		}
		return scrollEl.scrollTop >= maxScrollTop - 1;
	}

	private getAutoscrollSpeedForFile(file: TFile | null): number {
		if (!file) {
			return DEFAULT_AUTOSCROLL_SPEED;
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const speedValue = getFrontmatterValue(
			cache?.frontmatter,
			AUTOSCROLL_SPEED_KEY,
		);

		return parseAutoscrollSpeed(speedValue);
	}

	private getScrollElement(): HTMLElement | null {
		if (!this.isPreviewMode()) {
			return null;
		}

		// Candidate selectors in priority order.
		const selectors = [".markdown-reading-view", ".markdown-preview-view"];

		// First pass: prefer an element that actually has scrollable content.
		for (const sel of selectors) {
			const el = this.view.contentEl.querySelector<HTMLElement>(sel);
			if (el && el.scrollHeight > el.clientHeight) {
				return el;
			}
		}

		// Second pass: accept any matching element (content may not have
		// rendered its full height yet on the first click).
		for (const sel of selectors) {
			const el = this.view.contentEl.querySelector<HTMLElement>(sel);
			if (el) {
				return el;
			}
		}

		return null;
	}

	private isPreviewMode(): boolean {
		return this.view.getMode() === "preview";
	}

	onLayoutChange(): void {
		if (this.isRunning && !this.isPreviewMode()) {
			this.stop();
			return;
		}

		this.refreshButtonState();
	}

	private refreshButtonState(): void {
		const isPreviewMode = this.isPreviewMode();
		if (!isPreviewMode && this.isRunning) {
			this.isRunning = false;
		}

		setIcon(this.buttonEl, this.isRunning ? "pause" : "scroll-text");
		this.buttonEl.toggleClass("is-active", this.isRunning);
		this.buttonEl.toggleClass("is-disabled", !isPreviewMode);
		this.buttonEl.setAttribute("aria-disabled", String(!isPreviewMode));
		this.buttonEl.setAttribute(
			"aria-label",
			!isPreviewMode
				? "Auto scroll is only available in reading view"
				: this.isRunning
					? "Stop auto scroll"
					: "Start auto scroll",
		);
	}
}

export function registerAutoscrollFeature(plugin: Plugin): void {
	const controllers = new Map<WorkspaceLeaf, MarkdownAutoscrollController>();

	const syncControllers = (): void => {
		const markdownLeaves = new Set(thisPluginMarkdownLeaves(plugin));

		for (const [leaf, controller] of controllers.entries()) {
			if (!markdownLeaves.has(leaf)) {
				controller.destroy();
				controllers.delete(leaf);
			}
		}

		for (const leaf of markdownLeaves) {
			if (controllers.has(leaf)) {
				continue;
			}

			if (!(leaf.view instanceof MarkdownView)) {
				continue;
			}

			controllers.set(
				leaf,
				new MarkdownAutoscrollController(plugin, leaf, leaf.view),
			);
		}

		for (const controller of controllers.values()) {
			controller.onLayoutChange();
		}
	};

	const stopAllControllers = (): void => {
		for (const controller of controllers.values()) {
			controller.stop();
		}
	};

	plugin.registerEvent(
		plugin.app.workspace.on("layout-change", syncControllers),
	);
	plugin.registerEvent(
		plugin.app.workspace.on("active-leaf-change", syncControllers),
	);
	plugin.registerEvent(
		plugin.app.workspace.on("file-open", stopAllControllers),
	);

	plugin.register(() => {
		for (const controller of controllers.values()) {
			controller.destroy();
		}
		controllers.clear();
	});

	syncControllers();
}

function thisPluginMarkdownLeaves(plugin: Plugin): WorkspaceLeaf[] {
	return plugin.app.workspace.getLeavesOfType("markdown");
}

function getFrontmatterValue(frontmatter: unknown, key: string): unknown {
	if (!frontmatter || typeof frontmatter !== "object") {
		return undefined;
	}

	return (frontmatter as Record<string, unknown>)[key];
}
