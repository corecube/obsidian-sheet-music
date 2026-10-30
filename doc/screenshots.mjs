// Captures the README screenshots from a running Obsidian instance.
//
// Usage:
//   1. Start Obsidian with the DevTools port open:
//        open -a Obsidian --args --remote-debugging-port=9222
//   2. npm run screenshots
//
// The script copies doc/screenshots.md into the vault root, opens it in
// reading view and captures one block per feature (with chips opened where
// the README describes them) into doc/img/. Defaults: dark theme, phone-sized mobile
// emulation. SCREENSHOT_THEMES=light,dark captures both themes (files then
// get a -light / -dark suffix); SCREENSHOT_MOBILE=0 captures the desktop
// layout at 900px instead.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
const vault = resolve(repo, "../../..");
const port = process.env.OBSIDIAN_DEBUG_PORT ?? "9222";
const themes = (process.env.SCREENSHOT_THEMES ?? "dark").split(",");
const mobile = process.env.SCREENSHOT_MOBILE !== "0";
const noteName = "README screenshots.md";
const outDir = resolve(here, "img");
const viewport = mobile
	? { width: 430, height: 2800, deviceScaleFactor: 3 }
	: { width: 900, height: 2800, deviceScaleFactor: 2 };
const pad = 12;

copyFileSync(resolve(here, "screenshots.md"), resolve(vault, noteName));
mkdirSync(outDir, { recursive: true });

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const pages = targets.filter((t) => t.type === "page" && t.url.startsWith("app://obsidian.md/"));
if (pages.length === 0) throw new Error("No Obsidian window found on port " + port);

let nextId = 1;
const pending = new Map();
let ws;
const send = (method, params = {}) =>
	new Promise((res, rej) => {
		const id = nextId++;
		pending.set(id, { res, rej });
		ws.send(JSON.stringify({ id, method, params }));
	});
const connect = (url) =>
	new Promise((res, rej) => {
		ws = new WebSocket(url);
		ws.onopen = () => res();
		ws.onerror = (e) => rej(e);
		ws.onmessage = (m) => {
			const msg = JSON.parse(m.data);
			if (!msg.id) return;
			const p = pending.get(msg.id);
			pending.delete(msg.id);
			if (msg.error) p.rej(new Error(msg.error.message));
			else p.res(msg.result);
		};
	});
const evaluate = async (expression) => {
	const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
	if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
	return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// app.emulateMobile() reloads the window; wait until the app object is back.
const waitForApp = async () => {
	for (let i = 0; i < 80; i++) {
		try {
			if (await evaluate("typeof app !== 'undefined' && !!app.workspace && app.workspace.layoutReady === true")) return;
		} catch { /* window still reloading */ }
		await sleep(250);
	}
	throw new Error("Obsidian did not come back after toggling mobile emulation");
};
// Obsidian renders previews on animation frames, which Chromium pauses while the
// window is hidden; without this every heading lookup fails on a background window.
const bringToFront = async () => {
	await send("Page.bringToFront");
	for (let i = 0; i < 20; i++) {
		if (await evaluate("document.visibilityState === 'visible'")) return;
		await sleep(250);
	}
	throw new Error("Obsidian window is not visible; bring it to the foreground and retry");
};
const isMobile = () => evaluate("document.body.classList.contains('is-mobile')");
const setMobile = async (on) => {
	if ((await isMobile()) === on) return;
	await evaluate(`app.emulateMobile(${on})`);
	await sleep(500);
	await waitForApp();
	await bringToFront();
};

// Pick the window that has our vault open.
let picked = null;
for (const page of pages) {
	await connect(page.webSocketDebuggerUrl);
	const base = await evaluate("app.vault.adapter.basePath");
	if (resolve(base) === vault) { picked = page; break; }
	ws.close();
}
if (!picked) throw new Error("No Obsidian window has the vault " + vault);
console.log("Connected to", picked.title);

const originalTheme = await evaluate("app.vault.getConfig('theme')");

// Opens the screenshot note in the given mode and verifies it is the active view.
// After a window reload the vault index may lag behind the copied file, so poll for it.
const openNote = async (mode) => {
	for (let attempt = 0; attempt < 20; attempt++) {
		const ok = await evaluate(`(async () => {
			app.workspace.leftSplit?.collapse?.();
			app.workspace.rightSplit?.collapse?.();
			const file = app.vault.getAbstractFileByPath(${JSON.stringify(noteName)});
			if (!file) return "no file";
			const leaf = app.workspace.getLeaf(false);
			await leaf.openFile(file, { state: { mode: ${JSON.stringify(mode)}, source: ${mode === "source"} } });
			app.workspace.setActiveLeaf(leaf, { focus: true });
			await new Promise(r => setTimeout(r, 300));
			const view = app.workspace.activeLeaf?.view;
			if (view?.file?.path !== ${JSON.stringify(noteName)}) return "not active: " + view?.file?.path;
			if (view.getMode?.() !== ${JSON.stringify(mode)}) return "mode " + view.getMode?.();
			return "ok";
		})()`);
		if (ok === "ok") return;
		if (attempt === 19) throw new Error("could not open the screenshot note: " + ok);
		await sleep(500);
	}
};

// Obsidian's mobile layout (is-mobile class, touch-sized chips) needs its own switch.
await waitForApp();
await bringToFront();
await setMobile(mobile);
await send("Emulation.setDeviceMetricsOverride", { ...viewport, mobile });
await openNote("preview");
await sleep(500);

// Scroll through the whole note so every section is rendered.
const renderAll = () => evaluate(`(async () => {
	const scroller = app.workspace.activeLeaf.view.contentEl.querySelector(".markdown-preview-view");
	for (let y = 0; y <= scroller.scrollHeight; y += scroller.clientHeight / 2) {
		scroller.scrollTop = y;
		await new Promise(r => setTimeout(r, 150));
	}
	scroller.scrollTop = 0;
})()`);

// Waits until an element's layout and scroll position have settled, then returns its viewport rect.
const settledRect = `async (el, root) => {
	let last = null;
	for (let i = 0; i < 20; i++) {
		await new Promise(r => setTimeout(r, 250));
		const r = el.getBoundingClientRect();
		const now = { x: r.left, y: r.top, width: r.width, height: r.height, vh: window.innerHeight, vw: window.innerWidth, scroll: root?.scrollTop ?? 0 };
		if (last && JSON.stringify(last) === JSON.stringify(now)) return now;
		last = now;
	}
	return last;
}`;

// Reading view: the block under a heading of screenshots.md, after opening its chips.
const locateBlock = (heading, chips) => `(async () => {
	const root = app.workspace.activeLeaf.view.contentEl.querySelector(".markdown-preview-view");
	const h = [...root.querySelectorAll("h2")].find(e => e.textContent.trim() === ${JSON.stringify(heading)});
	if (!h) return { error: "heading not found" };
	const section = h.closest(".markdown-preview-section > div") ?? h.parentElement;
	let block = null;
	for (let s = section.nextElementSibling; s; s = s.nextElementSibling) {
		block = s.querySelector("[class*='block-language-']");
		if (block) break;
		if (s.querySelector("h2")) break;
	}
	if (!block) return { error: "block not found" };
	for (const label of ${JSON.stringify(chips ?? [])}) {
		const chip = [...block.querySelectorAll("button")].find(b => b.textContent.trim() === label);
		if (!chip) return { error: "chip not found: " + label };
		const pressed = chip.getAttribute("aria-pressed") === "true" || chip.classList.contains("is-active");
		if (!pressed) chip.click();
	}
	await new Promise(r => setTimeout(r, 900));
	block.scrollIntoView({ block: "start" });
	root.scrollTop = Math.max(0, root.scrollTop - ${pad * 2});
	return (${settledRect})(block, root);
})()`;

// Any element of the active leaf by selector (e.g. the view header).
const locateSelector = (selector) => `(async () => {
	const el = app.workspace.activeLeaf.view.containerEl.querySelector(${JSON.stringify(selector)});
	if (!el) return { error: "selector not found" };
	return (${settledRect})(el, null);
})()`;

// Live Preview: the fenced block under a heading, with the cursor inside so the editor highlighting is active.
const locateEditorBlock = (heading) => `(async () => {
	const view = app.workspace.activeLeaf.view;
	const editor = view.editor;
	const lines = editor.getValue().split("\\n");
	const hi = lines.indexOf("## " + ${JSON.stringify(heading)});
	const start = lines.findIndex((l, i) => i > hi && l.startsWith("\`\`\`"));
	const end = lines.findIndex((l, i) => i > start && l.trim() === "\`\`\`");
	if (hi < 0 || start < 0 || end < 0) return { error: "fence not found" };
	const cm = editor.cm;
	const pos = cm.state.doc.line(start + 2).from;
	cm.focus();
	cm.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
	await new Promise(r => setTimeout(r, 300));
	editor.scrollIntoView({ from: { line: Math.max(0, start - 1), ch: 0 }, to: { line: end, ch: 0 } }, true);
	await new Promise(r => setTimeout(r, 600));
	const node = cm.domAtPos(pos).node;
	const active = (node.nodeType === 1 ? node : node.parentElement).closest(".cm-line");
	if (!active) return { error: "active line not found" };
	let first = active, last = active;
	while (first.previousElementSibling?.classList.contains("HyperMD-codeblock")) first = first.previousElementSibling;
	while (last.nextElementSibling?.classList.contains("HyperMD-codeblock")) last = last.nextElementSibling;
	const scroller = view.contentEl.querySelector(".cm-scroller");
	const a = first.getBoundingClientRect(), b = last.getBoundingClientRect();
	return { x: a.left, y: a.top, width: Math.max(a.width, b.width), height: b.bottom - a.top, vh: window.innerHeight, vw: window.innerWidth, scroll: scroller.scrollTop };
})()`;

const captures = [
	{ name: "abc", heading: "abc" },
	{ name: "strumming", heading: "strumming" },
	{ name: "chords", heading: "chords", chips: ["Guitar", "Piano"] },
	{ name: "progression", heading: "progression", chips: ["Score"] },
	{ name: "midi", heading: "midi" },
	{ name: "header-controls", selector: ".view-header .view-actions" },
];

const shoot = async (file, rect) => {
	const clip = {
		x: Math.max(0, rect.x - pad),
		y: Math.max(0, rect.y - pad),
		width: Math.min(rect.width + pad * 2, rect.vw),
		height: Math.min(rect.height + pad * 2, rect.vh),
		scale: 1,
	};
	const { data } = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: false });
	writeFileSync(file, Buffer.from(data, "base64"));
};

for (const theme of themes) {
	await evaluate(`app.changeTheme(${JSON.stringify(theme === "dark" ? "obsidian" : "moonstone")})`);
	await sleep(1500);
	let mode = "preview";
	for (const c of captures) {
		const wanted = c.editor ? "source" : "preview";
		if (mode !== wanted) {
			await openNote(wanted);
			await sleep(800);
			if (wanted === "preview") await renderAll();
			mode = wanted;
		}
		let rect;
		for (let attempt = 0; attempt < 5; attempt++) {
			rect = await evaluate(c.editor ? locateEditorBlock(c.editor) : c.selector ? locateSelector(c.selector) : locateBlock(c.heading, c.chips));
			if (!rect.error) break;
			if (mode === "preview") await renderAll();
			await sleep(500);
		}
		if (rect.error) { console.error(`${c.name}: ${rect.error}`); continue; }
		if (rect.height + pad * 2 > rect.vh) console.warn(`${c.name}: block taller than viewport (${Math.round(rect.height)}px), cropped`);
		const file = resolve(outDir, themes.length > 1 ? `${c.name}-${theme}.png` : `${c.name}.png`);
		await shoot(file, rect);
		console.log(`${file.split("/").pop()}  ${Math.round(rect.width)}x${Math.round(rect.height)}`);
	}
}

// Restore the user's Obsidian.
await evaluate(`app.changeTheme(${JSON.stringify(originalTheme ?? "system")})`);
await send("Emulation.clearDeviceMetricsOverride");
await setMobile(false);
await evaluate("app.workspace.leftSplit?.expand?.(); app.workspace.rightSplit?.expand?.();");
ws.close();
console.log("Done →", outDir);
