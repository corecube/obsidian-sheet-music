# Sheet Music

Render playable music notation inside your Obsidian notes. Supports ABC notation, strumming patterns, chord sheets, and live MIDI capture.

---

## Features

| Block type    | What it does                                                                   |
| ------------- | ------------------------------------------------------------------------------ |
| `abc`         | Renders staff notation with playback, tempo control, and transposition         |
| `strumming`   | Renders rhythm patterns with timing labels and animated playback               |
| `chords`      | Renders lyric-and-chord sheets with chord diagrams, transposition, and lyrics translation |
| `progression` | Shows chord progressions with Roman numeral analysis                           |
| `midi`        | Plays back a captured MIDI recording with transport controls and `.mid` export |

**MIDI capture** — connect a keyboard and record live playing directly into a `midi` block.

---

## Usage

### ABC notation

````md
```abc
T: Greensleeves
M: 3/4
L: 1/8
K: Em
E2|G3A B2|c3B A2|
```
````

The block renders notation and adds playback controls. Click any note to start playback from that position. Use the transpose buttons to shift pitch up or down by semitone.

#### Custom render options

Place a JSON object at the top, separated from the ABC body by `---`. Any [abcjs visual parameter](https://docs.abcjs.net/) is accepted. Invalid JSON shows an error banner but still renders the notation.

````md
```abc
{"swing": 70}
---
X:1
T: It Don't Mean A Thing
M: 4/4
L: 1/8
K: _B
V:Guitar clef=treble
V:Bass clef=bass
[V:Guitar] _d_d z2 c2 _b,2| G4 z4 |
[V:Bass] _E,,4 D,,4|G,,4 z4 |
```
````

---

### Strumming patterns

The block takes a JSON object. `measures` is an array of stroke tokens (see table below).

````md
```strumming
{
    "part": "Verse",
    "bpm": 96,
    "denominator": 8,
    "isTriplet": false,
    "measures": [1, 101, 1, 101, 1, 101, 1, 101]
}
```
````

Use the speed slider to slow down the playback animation while learning a pattern.

#### Fields

| Field         | Type        | Required | Description                                                   |
| ------------- | ----------- | -------- | ------------------------------------------------------------- |
| `measures`    | `number[]`  | Yes      | Sequence of stroke tokens                                     |
| `denominator` | `8` \| `16` | Yes      | Subdivisions — `8` for eighth notes, `16` for sixteenth notes |
| `isTriplet`   | `boolean`   | Yes      | `true` for triplet feel                                       |
| `bpm`         | `number`    | No       | Tempo (default: 90)                                           |
| `part`        | `string`    | No       | Label shown in the controls row (e.g. `"Chorus"`)             |

#### Stroke tokens

| Token      | Value | Meaning                  |
| ---------- | ----- | ------------------------ |
| Down       | `1`   | Downstroke               |
| BeatDown   | `2`   | Accented downstroke      |
| AccentDown | `3`   | Strong accent downstroke |
| Up         | `101` | Upstroke                 |
| BeatUp     | `102` | Accented upstroke        |
| AccentUp   | `103` | Strong accent upstroke   |
| Muted      | `201` | Muted / dead note        |
| Rest       | `202` | Rest                     |
| Sustain    | `203` | Sustain / hold           |

---

### Chord sheets

Enclose chord names in `[brackets]` inline with lyrics. Lines containing only a bracketed name are treated as section headers.

````md
```chords
Am[x02210]
C[x32010]
G[320003]

[Verse 1]

[C] La luz de tu mirar[G], tu hermoso caminar
[Am] No existe nadie como [C]tú

[Chorus]

[C]En dondequiera que esté[G]s, ahí esta[Am]ré
```
````

Chord diagrams (guitar and piano), transpose controls, and the **Show/Hide translation** toggle are available in the collapsible **chord tools** panel above the sheet. Define custom voicings by appending a fret string directly to the chord name: `Am[x02210]`.

#### Lyrics translation

Translate the lyrics of a chord sheet into the language configured in settings (default: `en`). Each lyric line gets its translation inserted as a `> `-prefixed line directly below it:

````md
```chords
[C] La luz de tu mirar[G], tu hermoso caminar
> The light of your gaze, your beautiful walk
[Am] No existe nadie como [C]tú
> There is no one like you
```
````

Two ways to run it:

- **Ribbon button** (*Translate chord blocks in active note*) — translates every `chords` block in the current note.
- **Command palette** (*Translate chord blocks in all notes*) — translates every `chords` block in the vault. Notes are edited directly; a notice shows progress. If the run stops on an error, run the command again to continue where it left off.

Translation uses Google Translate (internet connection required) with automatic source-language detection. Chord markers are stripped before translating, and section headers, chord-only lines, and custom voicing lines are skipped. Re-running is safe — existing translations are replaced, never duplicated.

The **Show/Hide translation** button in the chord tools panel toggles translation visibility across all chord sheets without deleting anything; the choice persists across restarts.

#### Roman numeral analysis

Add a `key` property to the note's frontmatter and each chord diagram will show its Roman numeral below the diagram:

```yaml
---
key: C
---
```

With `key: C`, the diagram for `Am` is labelled `VIm`, `G` becomes `V`, and so on. Works with minor keys too (`key: Am`). If the chord cannot be resolved in the given key the label is omitted.

---

### Chord progressions

Write progressions as Roman numerals or chord names — the block resolves the other direction automatically.

The first line must be the key (`C`, `Am`, `F#`, `Bb`, etc.).

**Roman numerals → chord names:**

````md
```progression
C
I IIm V7 I
IVmaj7 V I
```
````

**Chord names → Roman numerals:**

````md
```progression
Am
Am Dm E Am
F C E Am
```
````

**Mixed rows** — each line is interpreted independently, so you can freely mix both styles.

Tonal's convention: minor chords use uppercase + `m` suffix (`IIm`, `VIm`), borrowed chords use a flat prefix (`bVII`).

---

### MIDI capture

#### Recording

1. Open a note in edit mode and place the cursor where you want the recording inserted.
2. Connect a MIDI keyboard.
3. Click **Start MIDI capture** — the icon changes to a stop square.
4. Play on your keyboard.
5. Click the button again to stop. A `midi` block is inserted at the cursor.

#### Playback

The `midi` block renders an inline player:

- **▶ / ■** — play or stop the recording
- **time display** — shows elapsed time and total duration
- **↓** — exports a Standard MIDI File (`.mid`) for use in a DAW or notation app
- **device label** — shows the MIDI output device being used, or `built-in` when falling back to Web Audio oscillator synthesis

If a MIDI output device is connected, playback is routed to it. The player automatically switches devices without needing to reload the note.

---

### Auto-scroll

Toggle auto-scroll with the action button in the top-right corner of any note. Configure the scroll speed per note in frontmatter:

```yaml
---
autoscroll-speed: 5
---
```

If omitted or invalid, the default speed of `5` is used.

When translation lines are visible in chord sheets, the scroll speed is automatically compensated for the extra height, so the song takes roughly the same time to scroll through.

---

## Settings

Open **Settings → Sheet Music** to configure each package independently.

| Section      | Setting                       | Default   |
| ------------ | ----------------------------- | --------- |
| Progression  | Enable                        | on        |
| ABC          | Enable                        | on        |
| ABC          | Staff width                   | 740 px    |
| ABC          | Scale                         | 1.0×      |
| ABC          | MIDI instrument               | 0 (Piano) |
| Strumming    | Enable                        | on        |
| Chords       | Enable                        | on        |
| Chords       | Expand chord tools by default | off       |
| Chords       | Translation target language   | `en`      |
| MIDI Capture | Enable                        | on        |

---

## Installation

Install via the Obsidian community plugin browser (**Settings → Community plugins → Browse → "Sheet Music"**), or manually:

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them to `<vault>/.obsidian/plugins/sheet-music/`.
3. Enable the plugin in **Settings → Community plugins**.

---

## Development

```bash
npm install       # install dependencies
npm run dev       # watch mode build
npm run build     # type-check + production build
npm test          # Jest test suite
npm run lint      # ESLint
```

**Requirements:** Node 18+, Obsidian 1.5.0+

### References

- [abcjs documentation](https://docs.abcjs.net/)
- [Obsidian API](https://docs.obsidian.md)
