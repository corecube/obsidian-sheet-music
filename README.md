# Obsidian Sheet Music

This plugin renders playable music notation directly inside Obsidian. It currently supports three notation formats:

- `abc` for staff notation with playback, tempo control, and transposition
- `strumming` for rhythm and chord-pattern blocks with playback animation
- `chords` for lyric-and-chord sheets with highlighted chord and section markers
- MIDI keyboard capture that transcribes live playing into an `abc` code block

## Features

- Render ABC notation directly in markdown notes
- Play ABC notation with adjustable tempo
- Transpose ABC notation up or down while viewing
- Pass custom `abcjs` render options from a JSON header
- Render strumming patterns with timing rows and optional chord rows
- Render chord sheets from `chords` code blocks
- Highlight chord and section markers enclosed in brackets (for example `[C]` and `[Verse 1]`)
- Toggle note auto-scroll from a top-right view action button
- Capture live MIDI input and insert it as ABC notation into the active note

## Usage

### ABC notation

Use an `abc` code block for inline notation:

```abc
T: Greensleeves
M: 3/4
L: 1/8
K: Em
E2|G3A B2|c3B A2|
```

ABC blocks render notation, add playback controls, and support note selection plus transposition.

### ABC with custom render options

Place a JSON object at the top of the block, then a separator line `---`, then the ABC body.

- The JSON header is optional.
- The separator is only needed when you provide a JSON header.
- Invalid JSON does not block rendering. The tune still renders and an error banner is shown above the score.

```abc
{
  "tablature": [{"instrument": "violin"}]
}
---
X:1
T: Cooley's
M: 4/4
L: 1/8
R: reel
K: G
|:D2|EB{c}BA B2 EB|~B2 AB dBAG|FDAD BDAD|FDAD dAFD|
```

Example with swing rendering:

```abc
{"swing":70}
---
X:1
T: It Don't Mean A Thing
M: 4/4
L: 1/8
K:_B
V:Guitar clef=treble
V:Bass clef=bass
[V:Guitar]
_d_d z2 c2 _b,2| G4 z4 |
[V:Bass]
_E,,4 D,,4|G,,4 z4 |
```

See the abcjs options reference for supported render options:
https://docs.abcjs.net/

### Strumming patterns

Use a `strumming` code block for rhythmic guitar-style patterns:

```strumming
{
	"part": "Verse",
	"bpm": 96,
	"denominator": 8,
	"isTriplet": false,
	"measures": [1, 101, 1, 101, 1, 101, 1, 101]
}
```

Strumming blocks render stroke rows, timing labels, optional chord rows, and a playback animation with speed control.

Example with chords:

```strumming
{
	"part": "Chorus",
	"bpm": 120,
	"denominator": 8,
	"isTriplet": false,
	"measures": [1, 102, 1, 102, 1, 102, 1, 102],
	"chords": ["G", "", "", "C", "G", "", "Em", "C"]
}
```

### Chord sheets

Use a `chords` code block for chord sheets where chord and section markers are enclosed in brackets.

```chords
Am[x02210]
C[x32010]
Dm[xx0231]
Dm7[xx0211]
F[133211]
G[320003]

[Verse 1]

[C] La luz de tu mirar[G], tu hermoso caminar
[Am]  No existe nadie como [F]tú
[C] The sky magenta blue,[G] it's only me and you
[Am]  Your eyes lit up are just the [F]moon

[Pre-Chorus]

Sé que habrán momentos de sufrimiento
But w[G]e'll be o[Am]kay
N[G]o soy perf[F]ecto
Pero[G]

[Chorus]

[C]En dondequiera que esté[G]s, ahí esta[Am]ré
Hoy y ma[F]ñana, por siempre, mi amo[C]r
Y si me voy[G], recuerda que[Dm]
For now and to[F]morrow, forever my love[C]
```

### Auto-scroll

Use the top-right note action button to toggle auto-scroll while reading a note.

You can configure the scroll speed per note in frontmatter with `autoscroll-speed`.
If omitted or invalid, the default speed is `5`.

```yaml
autoscroll-speed: 5
```

### MIDI capture

Connect a MIDI keyboard and use the ribbon button (music note icon) to record directly into a note.

1. Open a note in edit mode and position the cursor where you want the notation inserted.
2. Click the **Start MIDI capture** ribbon button — the icon changes to a stop square while recording is active.
3. Play on your MIDI keyboard.
4. Click the button again to stop. The captured performance is inserted as an `abc` code block at the cursor.

The ribbon button is hidden automatically when no MIDI input devices are connected, and reappears as soon as a device is plugged in.

**What the transcription produces:**

- **Key detection** — the key signature is inferred automatically from the notes you played (prefers simpler keys when there is a tie).
- **Grand staff** — if notes span both above and below middle C, two voices are written: `V:V1 clef=treble` and `V:V2 clef=bass`. Single-range performances use one voice with the appropriate clef.
- **Chords** — notes played within 50 ms of each other are grouped into a chord `[...]`.
- **Rests** — gaps longer than 50 ms between notes are transcribed as rests (`z`).
- **Duration quantization** — note lengths are quantized to the nearest sixteenth note (L:1/8 half-unit).
- **Sustain pedal** — sustain CC 64 is tracked; notes held by the pedal are finalized when the pedal is released.
- **Tempo** — the BPM configured in plugin settings is written into the `Q:` header and used for quantization.

You can configure the capture BPM in **Settings → MIDI Capture**.

## Settings

The plugin settings let you enable or disable each notation package independently.

- ABC settings: staff width, scale, playback instrument
- Strumming settings: package enable toggle
- Chords settings: package enable toggle
- MIDI Capture settings: capture BPM

## Development

### Install

```bash
npm install
```

### Run in watch mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

## References

- Obsidian API docs: https://docs.obsidian.md
- abcjs docs: https://docs.abcjs.net/
