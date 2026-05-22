# Sheet Music

Render playable music notation inside your Obsidian notes. Supports ABC notation, MusicXML scores, strumming patterns, chord sheets, and live MIDI capture.

---

## Features

| Block type | What it does |
|---|---|
| `abc` | Renders staff notation with playback, tempo control, and transposition |
| `musicxml` | Renders engraved sheet music from MusicXML source |
| `strumming` | Renders rhythm patterns with timing labels and animated playback |
| `chords` | Renders lyric-and-chord sheets with chord diagrams and transposition |
| `progression` | Shows chord progressions with Roman numeral analysis |

**MIDI capture** — connect a keyboard and transcribe live playing directly into an `abc` block.

---

## Usage

### ABC notation

~~~md
```abc
T: Greensleeves
M: 3/4
L: 1/8
K: Em
E2|G3A B2|c3B A2|
```
~~~

The block renders notation and adds playback controls. Click any note to start playback from that position. Use the transpose buttons to shift pitch up or down by semitone.

#### Custom render options

Place a JSON object at the top, separated from the ABC body by `---`. Any [abcjs visual parameter](https://docs.abcjs.net/) is accepted. Invalid JSON shows an error banner but still renders the notation.

~~~md
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
~~~

---

### MusicXML

Paste MusicXML directly into a `musicxml` block, or open a `.musicxml` file from your vault in the dedicated notation view.

~~~md
```musicxml
<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration><type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>
```
~~~

---

### Strumming patterns

The block takes a JSON object. `measures` is an array of stroke tokens (see table below).

~~~md
```strumming
{
    "part": "Verse",
    "bpm": 96,
    "denominator": 8,
    "isTriplet": false,
    "measures": [1, 101, 1, 101, 1, 101, 1, 101]
}
```
~~~

Use the speed slider to slow down the playback animation while learning a pattern.

#### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `measures` | `number[]` | Yes | Sequence of stroke tokens |
| `denominator` | `8` \| `16` | Yes | Subdivisions — `8` for eighth notes, `16` for sixteenth notes |
| `isTriplet` | `boolean` | Yes | `true` for triplet feel |
| `bpm` | `number` | No | Tempo (default: 90) |
| `part` | `string` | No | Label shown in the controls row (e.g. `"Chorus"`) |

#### Stroke tokens

| Token | Value | Meaning |
|---|---|---|
| Down | `1` | Downstroke |
| BeatDown | `2` | Accented downstroke |
| AccentDown | `3` | Strong accent downstroke |
| Up | `101` | Upstroke |
| BeatUp | `102` | Accented upstroke |
| AccentUp | `103` | Strong accent upstroke |
| Muted | `201` | Muted / dead note |
| Rest | `202` | Rest |
| Sustain | `203` | Sustain / hold |

---

### Chord sheets

Enclose chord names in `[brackets]` inline with lyrics. Lines containing only a bracketed name are treated as section headers.

~~~md
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
~~~

Chord diagrams (guitar and piano) and transpose controls are available in the collapsible **chord tools** panel above the sheet. Define custom voicings by appending a fret string directly to the chord name: `Am[x02210]`.

---

### Chord progressions

Write progressions as Roman numerals or chord names — the block resolves the other direction automatically.

The first line must be the key (`C`, `Am`, `F#`, `Bb`, etc.).

**Roman numerals → chord names:**

~~~md
```progression
C
I IIm V7 I
IVmaj7 V I
```
~~~

**Chord names → Roman numerals:**

~~~md
```progression
Am
Am Dm E Am
F C E Am
```
~~~

**Mixed rows** — each line is interpreted independently, so you can freely mix both styles.

Tonal's convention: minor chords use uppercase + `m` suffix (`IIm`, `VIm`), borrowed chords use a flat prefix (`bVII`).

---

### MIDI capture

1. Connect a MIDI keyboard. The ribbon button (music note icon) appears automatically.
2. Open a note in edit mode and place the cursor where you want the notation inserted.
3. Click **Start MIDI capture** — the icon changes to a stop square.
4. Play on your keyboard.
5. Click the button again to stop. An `abc` block is inserted at the cursor.

---

### Auto-scroll

Toggle auto-scroll with the action button in the top-right corner of any note. Configure the scroll speed per note in frontmatter:

```yaml
---
autoscroll-speed: 5
---
```

If omitted or invalid, the default speed of `5` is used.

---

## Settings

Open **Settings → Sheet Music** to configure each package independently.

| Section | Setting | Default |
|---|---|---|
| Progression | Enable | on |
| ABC | Enable | on |
| ABC | Staff width | 740 px |
| ABC | Scale | 1.0× |
| ABC | MIDI instrument | 0 (Piano) |
| MusicXML | Enable | on |
| MusicXML | Zoom | 1.0× |
| Strumming | Enable | on |
| Chords | Enable | on |
| Chords | Expand chord tools by default | off |
| MIDI Capture | Enable | on |
| MIDI Capture | Capture BPM | 120 |

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
- [OpenSheetMusicDisplay](https://opensheetmusicdisplay.github.io/)
- [Obsidian API](https://docs.obsidian.md)
