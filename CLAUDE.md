# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Watch mode build (incremental)
npm run build        # Type-check + production build + copy artifacts to vault
npm run lint         # ESLint across all .ts files
npm test             # Jest test suite
npm test -- --testPathPattern=src/abc   # Run tests for a single package
```

## Architecture

This Obsidian plugin renders multiple music notation formats inside notes. It is organized into six **packages** plus one cross-cutting feature:

```
src/
  main.ts          # Plugin lifecycle only — loads settings, registers each package
  settings.ts      # Shared settings interface, defaults, settings UI tab
  abc/             # ABC notation (abcjs library) with playback
  strumming/       # Strumming patterns with audio synthesis and playback animation
  chords/          # Chord sheets (lyrics + chord markers)
  progression/     # Chord progressions with Roman numeral analysis
  midi-capture/    # Live MIDI recording → ABC block insertion
  piano-monitor/   # Sidebar view: live note display + key/scale reference
  autoscroll/      # Cross-cutting: auto-scroll driven by note frontmatter
  utils/           # Shared utilities
```

### Package structure pattern

Most notation packages follow this layout:

| File | Responsibility |
|---|---|
| `renderer.ts` | Registers the Obsidian code block processor; owns DOM lifecycle |
| `renderer-logic.ts` | Pure parsing and model-building logic — no DOM, fully testable |
| `renderer-logic.test.ts` | Jest unit tests |
| `index.ts` | Barrel exports (`registerXxxPackage`) |

Additional package-specific files:
- **abc**: `playback.ts` — `AbcPlaybackController`, MIDI/audio playback via abcjs
- **strumming**: `parser.ts`, `stroke-token.ts` (data model), `audio.ts` (Web Audio synthesis), `animation.ts` + `animation-logic.ts` (beat animation)
- **chords**: `chords-parser.ts`, `chord-name.ts`, `guitar-chord.ts`, `piano-chord.ts`, `guitar-diagram.ts`, `piano-diagram.ts`, `transpose.ts`
- **midi-capture**: `midi-listener.ts` (Web MIDI API), `capture-session.ts` (stateful recording), `note-to-abc.ts` (conversion engine)
- **piano-monitor**: `view.ts` — sidebar `ItemView` with live abcjs staff, key reference, and scale browser

### Rendering pipeline (code block packages)

1. User writes a fenced code block: ` ```abc ... ``` `
2. Obsidian calls the registered processor for that language tag
3. `renderer.ts` calls `renderer-logic.ts` to parse content and build a render model
4. `renderer.ts` constructs DOM elements and attaches event listeners
5. Cleanup is handled via Obsidian's `registerMarkdownCodeBlockProcessor` lifecycle

### Non-block packages

- **midi-capture** — registers a ribbon button. On start: creates `CaptureSession` + `MidiListener` (Web MIDI API). On stop: calls `note-to-abc.ts` to convert captured notes and inserts an `abc` block at the editor cursor.
- **piano-monitor** — registers a sidebar `ItemView`. Uses `MidiListener` to track held notes in real time; renders them onto treble/bass staves via abcjs. Also provides a key-reference panel (Roman numerals + chord detection via `tonal`) and a scale browser.

### Key design invariant

`renderer-logic.ts` and pure utility files (e.g. `note-to-abc.ts`) must not import DOM or Obsidian APIs — this keeps them unit-testable with Jest. All Obsidian/DOM interaction lives exclusively in `renderer.ts` or view files.

### Settings

Each package has an enable/disable toggle. Additional per-package settings: ABC (staff width, scale, MIDI instrument), chords (expand tools by default), MIDI capture (BPM). Settings persist via `plugin.loadData()` / `plugin.saveData()`.

### Auto-scroll

Reads `autoscroll-speed` from note frontmatter. Registered unconditionally in `main.ts`, independent of any package toggle.

## Dependencies

- `abcjs` — ABC notation rendering + MIDI/audio playback; also used by piano-monitor for live staff rendering
- `tonal` — music theory (key detection, Roman numeral analysis, chord detection, scale lookup)
- `svguitar` + `@tombatossals/chords-db` — guitar chord diagram rendering
- All bundled into `main.js` by esbuild; `obsidian`, `electron`, and CodeMirror packages are externalized
