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

This Obsidian plugin renders multiple music notation formats inside notes. It is organized into four **notation packages** plus one cross-cutting feature:

```
src/
  main.ts          # Plugin lifecycle only — loads settings, registers each package
  settings.ts      # Shared settings interface, defaults, settings UI tab
  abc/             # ABC notation (abcjs library) with playback
  musicxml/        # MusicXML (OpenSheetMusicDisplay) with file view for .musicxml
  strumming/       # Strumming patterns with audio synthesis and playback animation
  chords/          # Chord sheets (lyrics + chord markers)
  autoscroll/      # Cross-cutting: auto-scroll driven by note frontmatter
```

### Package structure pattern

Each notation package follows the same layout:

| File | Responsibility |
|---|---|
| `renderer.ts` | Registers the Obsidian code block processor; owns DOM lifecycle |
| `renderer-logic.ts` | Pure parsing and model-building logic — no DOM, fully testable |
| `renderer-logic.test.ts` | Jest unit tests |
| `index.ts` | Barrel exports (`registerXxxPackage`) |

Additional package-specific files:
- **abc**: `playback.ts` — `AbcPlaybackController`, MIDI/audio playback via abcjs
- **musicxml**: `file-view.ts` — custom Obsidian `FileView` for standalone `.musicxml` files
- **strumming**: `parser.ts`, `stroke-token.ts` (data model), `audio.ts` (Web Audio synthesis), `animation.ts` + `animation-logic.ts` (beat animation)
- **chords**: `chords-parser.ts` — chord block parsing

### Rendering pipeline

1. User writes a fenced code block: ` ```abc ... ``` `
2. Obsidian calls the registered processor for that language tag
3. `renderer.ts` calls `renderer-logic.ts` to parse content and build a render model
4. `renderer.ts` constructs DOM elements (controls, sheet container, etc.) and attaches event listeners
5. Cleanup is handled via Obsidian's `registerMarkdownCodeBlockProcessor` lifecycle

### Key design invariant

`renderer-logic.ts` files must not import DOM or Obsidian APIs — this keeps them unit-testable with Jest. All Obsidian/DOM interaction lives exclusively in `renderer.ts`.

### Settings

Each package has an enable/disable toggle. Additional per-package settings: ABC (staff width, scale, MIDI instrument), MusicXML (zoom). Settings persist via `plugin.loadData()` / `plugin.saveData()`.

### Auto-scroll

Reads `autoscroll-speed` from note frontmatter. Registered independently of notation packages in `main.ts`.

## Dependencies

- `abcjs` — ABC notation rendering + playback
- `opensheetmusicdisplay` — MusicXML rendering
- All bundled into `main.js` by esbuild; `obsidian`, `electron`, and CodeMirror packages are externalized
