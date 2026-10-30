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

Define custom voicings by appending a fret string directly to the chord name: `Am[x02210]`. A six-character fret string defines a guitar voicing, a four-character one (`C[0003]`) a ukulele voicing.

While editing a `chords` block (source mode or Live Preview with the cursor inside it), chord names, section headers and brackets stay colour-coded.

#### Chord chips

Every `chords` block starts with a slim row of chips. Tap **Guitar**, **Ukulele** or **Piano** to show the diagrams of every chord used in the block for that instrument right below the row; tap again to hide them. Several panels can be open at once. Custom voicings are honoured and, if the note's frontmatter has a `key`, each chord also shows its Roman numeral.

The **−** / **+** chips at the start of the row transpose the block by a semitone and write the result back to the note. This works in reading view and on mobile.

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

The translation toggle (**Aa**) in the note header toggles translation visibility across all chord sheets without deleting anything; the choice persists across restarts. See [Auto-scroll → Header controls](#header-controls).

#### Roman numeral analysis

Add a `key` property to the note's frontmatter and each chord diagram opened from the Guitar, Ukulele or Piano chip will show its Roman numeral:

```yaml
---
key: C
---
```

With `key: C`, the diagram for `Am` is labelled `vi`, `G7` becomes `V7`, `Bdim` becomes `vii°`, and so on, in the same RomanText form the progression block uses. Works with minor keys too (`key: Am`). If the chord cannot be resolved in the given key the label is omitted.

---

### Chord progressions

Write progressions as Roman numerals or chord names — the block resolves the other direction automatically. Numerals follow the [RomanText](https://www.trecento.com/research/Tymoczko_Gotham_Cuthbert_Ariza_RomanText.pdf) chord grammar, the standard used by music21.

Give the key on the first line (`C`, `Am`, `F#`, `Bb`, or RomanText style `C:` / `c:` / `f#:`, lowercase = minor) or as an inline token such as `G:` before the first chord. Anything after `#` followed by a space is a comment; `#iv` is still a chord.

**Roman numerals → chord names:**

````md
```progression
C
I vi ii V7
IV V7/V V I
```
````

**Chord names → Roman numerals:**

````md
```progression
Am
Am Dm E7 Am
F C/E E Am
```
````

**Mixed rows** — tokens are interpreted independently, so numerals and chord names can share a line.

Cells are coloured by harmonic function: blue for tonic (`I`, `iii`, `vi`), green for predominant (`ii`, `IV`, `N6`, augmented sixths), red for dominant (`V`, `vii°`, `Cad64`), purple for applied chords (`V/V`) and orange for other chromatic roots (`bVII`). Hover a cell to see its function. The colours come from the theme palette, so they follow light and dark mode.

#### Transpose and editing

The key is shown bold at the top of the block. The **−** and **+** chips next to it transpose the block by a semitone and write the result back into the note: the key line, inline key tokens and chord names move, numerals and comments stay as they are. While a block is being edited, numerals are coloured by harmonic function in the editor too, with keys and chord names in the accent colour and RomanText markers, metadata and comments dimmed.

#### Score

A **Score** chip at the top of the block renders the progression as block chords on a grand staff, with the numeral under each chord as a lyric. Each row becomes one measure, the bass note sits on the lower staff and the remaining tones are stacked in close position above middle C. Inline key changes become key signature changes. The play button and tempo slider next to the chip play the chords back; `NC` and unresolved tokens become rests.

The score uses the ABC settings for staff width, scale and instrument. It starts hidden; turn **Show progression score** on in the settings to start every block with the score visible. The chip toggles it per block either way.

**A fuller example** using inversions, an applied dominant, a half-diminished seventh, a Neapolitan and a cadential 6/4:

````md
```progression
C
I vi ii V7
I6 IV V7/V V
vi iiø7 V7 I
N6 Cad64 V7 I
```
````

renders as

| I | vi | ii | V⁷ |
|---|---|---|---|
| C | Am | Dm | G7 |

| I⁶ | IV | V⁷/V | V |
|---|---|---|---|
| C/E | F | D7 | G |

| vi | iiø⁷ | V⁷ | I |
|---|---|---|---|
| Am | Dm7b5 | G7 | C |

| N⁶ | Cad⁶⁴ | V⁷ | I |
|---|---|---|---|
| Db/F | C/G | G7 | C |

#### Numeral grammar

| Element | Syntax | Example in C |
|---|---|---|
| Triad quality | uppercase major, lowercase minor | `I` C, `ii` Dm |
| Diminished / half-dim / augmented | `o` or `°`, `ø` or `/o`, `+` | `viio` Bdim, `viiø7` Bm7b5, `III+` E+ |
| Chromatic root | `b`, `#` prefix | `bVII` Bb, `#ivo7` F#dim7 |
| Triad inversions | `6`, `64` (or `6/4`) | `I6` C/E, `I64` C/G |
| Seventh chords | `7`, `65`, `43`, `42` | `V7` G7, `V65` G7/B, `V42` G7/F |
| Extensions | `9`, `11`, `13` | `V9` G9 |
| Applied chords | `/` + target, chains allowed | `V/V` D, `V7/IV` C7, `V7/V/V` A7 |
| Abbreviations | `N6`, `It6`, `Ger65`, `Fr43`, `Cad64` | `N6` Db/F, `Ger65` Ab C Eb F# |
| Alterations | `[no5]`, `[add9]`, `[b9]`, `[#3]` | `V7[b9]` G7(b9) |
| No chord | `NC` | — |
| Key change | `G:` / `g:` anywhere in a row | `I IV G: V I` |
| Pivot chord | key token between two readings of the same chord | `vi C: ii` in F: one Dm cell |

Sevenths are diatonic to the key (`I7` is Cmaj7, `ii7` is Dm7, `V7` is G7). In minor keys, degrees 6 and 7 are natural for major chords (`VII` is G in A minor) and raised for minor or diminished chords (`viio` is G#dim).

The older tonal-style spellings (`IIm`, `VIm`, `IVmaj7`, `VIIdim`) are still accepted and shown in RomanText form; an explicit `maj7` or `m7` keeps its seventh quality, so `Vmaj7` is Gmaj7 and displays as `V7[#7]`.

#### RomanText files

Lines copied from an `.rntxt` analysis work as-is, including the metadata header and the key given inline in measure 0. This block is the opening of the Bach chorale from the RomanText paper, extended with every construct the block understands:

````md
```progression
Composer: J. S. Bach          # metadata header, ignored
Time Signature: 3/4
Form: chorale
m0 b3 G: I                    # measure, beat, key with colon
m1 b2 IV6 b3 V6               # inversions: 6, 64, 7, 65, 43, 42
m2 I b2 V b3 vi               # case = quality, o dim, /o half-dim, + aug
m3 IV b2.5 viio6 b3 I         # decimal beats
m4 V || b3 I                  # || is a phrase boundary
m5 vi b2 ii6 b3 V7/IV         # applied chords, chained V7/V/V allowed
m6 I b2 Ger65 b3 Cad64 b3.5 V # abbreviations: N6, It6, Ger65, Fr43, Cad64
m7 bVI b2 V65[no5][b3]        # chromatic roots, bracketed alterations
m8 vi C: iii                  # pivot chord: Em is vi in G and iii in C
m9-10 = m1-2                  # repeat earlier measures
m11var1 ii                    # alternative reading
Note: consecutive first inversions
```
````

| Line | What it shows | Renders as |
|---|---|---|
| `Time Signature: 3/4` | meter: three beats per row in table and score | `3/4` next to the key |
| `Composer:`, `Form:`, `Note:` | metadata, ignored | — |
| `# comments start with "# "` | comment, ignored | — |
| `m0 b3 G: I` | measure label, beat marker (pickup: two empty beats first), inline key that sets the block key | key label `G:`, G |
| `m1 b2 IV6 b3 V6` | triad inversions | C/E, D/F# |
| `m2 I b2 V b3 vi` | case gives the quality | G, D, Em |
| `m3 IV b2.5 viio6 b3 I` | decimal beat (half-beat grid column), diminished first inversion | C, F#dim/A, G |
| `m4 V \|\| b3 I` | phrase boundary, ignored | D, G |
| `m5 vi b2 ii6 b3 V7/IV` | applied dominant | Em, Am/C, G7 |
| `m6 I b2 Ger65 b3 Cad64 b3.5 V` | German sixth, cadential 6/4 resolving on the half beat | G, Eb G Bb C#, G/D, D |
| `m7 bVI b2 V65[no5][b3]` | chromatic root, bracketed alterations | Eb, Dm7(no5)/F |
| `m8 vi C: iii` | pivot chord: one Em cell reading `vi = C: iii`; the key changes after it | Em |
| `m9-10 = m1-2` | repeat: measures 1–2 copied as 9–10 | C/E, D/F# then G, D, Em |
| `m11var1 ii` | variant reading, label ignored | Dm |

Each measure becomes one row, repeats included. With a `Time Signature:` line or beat markers the table becomes a beat grid: a chord's cell spans the beats it lasts, a late first chord (`m0 b3 I`) leaves a gap, and the time signature appears next to the key. The score then uses the same durations, so playback has the right rhythm. In a metered block, rows without beat markers place one chord per beat with the last chord filling the bar; more chords than beats are spread evenly. Blocks with neither a time signature nor beat markers are not timed, even when their rows carry measure labels. Beats outside the bar are clamped: `b4` in 3/4 is pulled back to the last half beat and the chord before it is shortened to make room.

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

#### Header controls

In reading view the note header (top-right) shows, left to right:

```
[Aa]  [−]  [+]  [⏵₅]
```

- **Aa** shows or hides chord-sheet translations (only when the chords package is enabled)
- **−** / **+** make scrolling slower or faster, one step at a time, effective immediately, also while scrolling
- **⏵** starts and stops auto-scroll; the small **badge** on it shows the current speed. It turns accent-colored when the speed differs from the note's configured value

Speed changes made via the header buttons are temporary: they last until another note is opened in that pane and are never written back to the frontmatter.

The header translation toggle changes the global setting, so it applies to every chord sheet.

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

### Screenshots

`doc/screenshots.mjs` captures one block per feature from `doc/screenshots.md` in a running Obsidian into `doc/img/` (not committed), for release notes or the community plugin listing. By default it uses the dark theme and Obsidian's mobile emulation at phone width; `SCREENSHOT_THEMES=light,dark` captures both themes and `SCREENSHOT_MOBILE=0` the desktop layout. Keep the blocks in that note identical to the examples above. Start Obsidian with the DevTools port open and run the script:

```bash
open -a Obsidian --args --remote-debugging-port=9222
npm run screenshots
```

The script copies the note into the vault root as `README screenshots.md`, opens it, captures every block into `doc/img/` and restores the theme and sidebars afterwards.

### References

- [abcjs documentation](https://docs.abcjs.net/)
- [Obsidian API](https://docs.obsidian.md)
