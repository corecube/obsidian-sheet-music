import {
	MarkdownView,
	Plugin,
	setIcon,
	TFile,
	type WorkspaceLeaf,
} from "obsidian";
import type SheetMusicPlugin from "../main";
import {
	areTranslationsVisible,
	onTranslationsChanged,
	toggleTranslations,
} from "../chords/translation-visibility";
import {
	adjustAutoscrollSpeed,
	calculateAutoscrollVelocity,
	calculateViewportCompensationFactor,
	DEFAULT_AUTOSCROLL_SPEED,
	FrameAccumulator,
	MAX_AUTOSCROLL_SPEED,
	type MeasuredLine,
	MIN_AUTOSCROLL_SPEED,
	parseAutoscrollSpeed,
} from "./logic";

const AUTOSCROLL_SPEED_KEY = "autoscroll-speed";
const REMEASURE_INTERVAL_MS = 2000;

class MarkdownAutoscrollController {
	private buttonEl: HTMLElement;
	private translationButtonEl: HTMLElement | null = null;
	private speedBadgeEl: HTMLElement;
	private speedHint = "";
	private slowerEl: HTMLElement;
	private fasterEl: HTMLElement;
	private unsubscribeTranslations: (() => void) | null = null;
	private isRunning = false;
	private rafId: number | null = null;
	private speed = DEFAULT_AUTOSCROLL_SPEED;
	/**
	 * Temporary speed chosen via the header buttons. Overrides the note's
	 * frontmatter speed until another file is opened in this leaf.
	 */
	private speedOverride: number | null = null;
	private accumulator = new FrameAccumulator();
	private compensation = 1;
	private lastFrameTime: number | null = null;
	private lastMeasureTime = 0;
	private lastMeasuredScrollTop = 0;

	constructor(
		private readonly plugin: Plugin,
		private readonly leaf: WorkspaceLeaf,
		private readonly view: MarkdownView,
	) {
		// `addAction` prepends, so add right-to-left:
		// [translations] [slower] [faster] [auto scroll + speed badge]
		this.buttonEl = this.view.addAction(
			"scroll-text",
			"Toggle auto scroll",
			() => this.toggle(),
		);
		this.buttonEl.addClass("sheet-music-autoscroll-toggle");
		// Speed badge overlaid on the toggle. Purely visual (no pointer
		// events) so every click on the button toggles scrolling. `setIcon`
		// wipes the button's children, so it is re-attached on every refresh.
		this.speedBadgeEl = createSpan({
			cls: "sheet-music-autoscroll-speed-badge",
			attr: { "aria-hidden": "true" },
		});

		this.fasterEl = this.view.addAction("plus", "Auto scroll faster", () =>
			this.adjustSpeed(1),
		);
		this.fasterEl.addClass("sheet-music-autoscroll-speed-btn");

		this.slowerEl = this.view.addAction("minus", "Auto scroll slower", () =>
			this.adjustSpeed(-1),
		);
		this.slowerEl.addClass("sheet-music-autoscroll-speed-btn");

		if (this.chordsEnabled()) {
			this.translationButtonEl = this.view.addAction(
				"languages",
				"Toggle translations",
				() => toggleTranslations(this.plugin),
			);
			this.translationButtonEl.addClass(
				"sheet-music-translation-toggle",
			);
			this.unsubscribeTranslations = onTranslationsChanged(() =>
				this.refreshTranslationState(),
			);
		}

		this.refreshButtonState();
		this.refreshTranslationState();
	}

	destroy(): void {
		this.stop();
		this.unsubscribeTranslations?.();
		this.translationButtonEl?.remove();
		this.slowerEl.remove();
		this.fasterEl.remove();
		this.buttonEl.remove();
	}

	private chordsEnabled(): boolean {
		return (this.plugin as SheetMusicPlugin).settings.packages.chords
			.enabled;
	}

	private refreshSpeedControls(): void {
		const isPreviewMode = this.isPreviewMode();
		const speed = this.currentSpeed;
		const base = this.getAutoscrollSpeedForFile(this.view.file);
		const hasOverride = this.speedOverride !== null;

		// Speed controls only make sense in reading view.
		for (const el of [this.slowerEl, this.speedBadgeEl, this.fasterEl]) {
			el.toggleClass("is-hidden", !isPreviewMode);
		}

		this.speedBadgeEl.setText(String(speed));
		this.speedBadgeEl.toggleClass("has-speed-override", hasOverride);
		this.speedHint = hasOverride
			? ` · speed ${speed} (note: ${base})`
			: ` · speed ${speed}`;

		this.slowerEl.toggleClass("is-disabled", speed <= MIN_AUTOSCROLL_SPEED);
		this.fasterEl.toggleClass("is-disabled", speed >= MAX_AUTOSCROLL_SPEED);
	}

	private refreshTranslationState(): void {
		if (!this.chordsEnabled()) {
			return;
		}
		const visible = areTranslationsVisible(this.plugin);
		const label = visible ? "Hide translations" : "Show translations";
		if (this.translationButtonEl) {
			this.translationButtonEl.toggleClass("is-active", visible);
			this.translationButtonEl.setAttribute("aria-label", label);
		}
	}

	/** Temporarily change the speed by `delta` steps for this leaf. */
	adjustSpeed(delta: number): void {
		const next = adjustAutoscrollSpeed(this.effectiveSpeed(), delta);
		this.speedOverride = next;
		this.speed = next;
		this.refreshButtonState();
	}

	/** Drop the temporary override when another note is opened in this leaf. */
	clearSpeedOverride(): void {
		this.speedOverride = null;
		this.speed = this.effectiveSpeed();
		this.refreshButtonState();
	}

	get currentSpeed(): number {
		return this.effectiveSpeed();
	}

	private effectiveSpeed(): number {
		return (
			this.speedOverride ?? this.getAutoscrollSpeedForFile(this.view.file)
		);
	}

	stop(): void {
		if (!this.isRunning) {
			return;
		}

		this.isRunning = false;
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
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

		this.speed = this.effectiveSpeed();
		this.isRunning = true;
		this.refreshButtonState();
		this.startScrolling();
	}

	private startScrolling(): void {
		const startEl = this.getScrollElement();
		this.accumulator = new FrameAccumulator();
		this.compensation = startEl ? this.compensationFactor(startEl) : 1;
		this.lastFrameTime = null;
		this.lastMeasureTime = 0;

		const frame = (now: number): void => {
			if (!this.isRunning || !this.isPreviewMode()) {
				this.stop();
				return;
			}

			const scrollEl = this.getScrollElement();
			if (!scrollEl) {
				this.stop();
				return;
			}

			if (this.lastFrameTime === null) {
				this.lastFrameTime = now;
				this.lastMeasureTime = now;
			}
			const elapsed = now - this.lastFrameTime;
			this.lastFrameTime = now;

			const scrolledSinceMeasure = Math.abs(
				scrollEl.scrollTop - this.lastMeasuredScrollTop,
			);
			if (
				now - this.lastMeasureTime >= REMEASURE_INTERVAL_MS ||
				scrolledSinceMeasure >= scrollEl.clientHeight / 4
			) {
				this.compensation = this.compensationFactor(scrollEl);
				this.lastMeasureTime = now;
			}

			// Recomputed per frame so header speed changes apply live.
			const velocity = calculateAutoscrollVelocity(this.speed);
			const px = this.accumulator.advance(
				elapsed,
				velocity * this.compensation,
			);
			if (px > 0) {
				scrollEl.scrollBy(0, px);
			}
			this.rafId = window.requestAnimationFrame(frame);
		};
		this.rafId = window.requestAnimationFrame(frame);
	}

	private compensationFactor(scrollEl: HTMLElement): number {
		this.lastMeasuredScrollTop = scrollEl.scrollTop;
		if (document.body.hasClass("sheet-music-hide-translations")) {
			return 1;
		}

		const els = Array.from(
			this.view.contentEl.querySelectorAll<HTMLElement>(
				".chords-notation-line",
			),
		);
		const lineHeight = measureSingleLineHeight(els);
		if (lineHeight <= 0) {
			return 1;
		}

		const lines: MeasuredLine[] = els.map((el) => {
			const rect = el.getBoundingClientRect();
			return {
				top: rect.top,
				height: rect.height,
				isTranslation: el.classList.contains(
					"chords-notation-line-translation",
				),
			};
		});
		const viewportRect = scrollEl.getBoundingClientRect();
		return calculateViewportCompensationFactor(
			lines,
			viewportRect.top,
			scrollEl.clientHeight,
			lineHeight,
		);
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

		this.refreshSpeedControls();
		this.refreshTranslationState();

		setIcon(this.buttonEl, this.isRunning ? "pause" : "scroll-text");
		this.buttonEl.appendChild(this.speedBadgeEl);
		this.buttonEl.toggleClass("is-active", this.isRunning);
		this.buttonEl.toggleClass("is-disabled", !isPreviewMode);
		this.buttonEl.setAttribute("aria-disabled", String(!isPreviewMode));
		this.buttonEl.setAttribute(
			"aria-label",
			!isPreviewMode
				? "Auto scroll is only available in reading view"
				: (this.isRunning ? "Stop auto scroll" : "Start auto scroll") +
					this.speedHint,
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
			// A new file in this leaf: temporary speed adjustments end here.
			controller.clearSpeedOverride();
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

function measureSingleLineHeight(lineEls: HTMLElement[]): number {
	const sample = lineEls.find(
		(el) => !el.classList.contains("chords-notation-line-translation"),
	);
	if (!sample) {
		return 0;
	}
	const style = window.getComputedStyle(sample);
	const lineHeight = Number.parseFloat(style.lineHeight);
	if (Number.isFinite(lineHeight) && lineHeight > 0) {
		return lineHeight;
	}
	// line-height: normal — approximate with the font's default ratio.
	const fontSize = Number.parseFloat(style.fontSize);
	return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.2 : 0;
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
