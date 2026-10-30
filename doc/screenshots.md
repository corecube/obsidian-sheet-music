---
key: C
---

Source note for the README screenshots. `npm run screenshots` copies this file into the vault root and captures every block below (one per feature) into `doc/img/`. Keep the blocks identical to the examples in `README.md`.

## abc

```abc
T: Greensleeves
M: 3/4
L: 1/8
K: Em
E2|G3A B2|c3B A2|
```

## strumming

```strumming
{
    "part": "Verse",
    "bpm": 96,
    "denominator": 8,
    "isTriplet": false,
    "measures": [1, 101, 1, 101, 1, 101, 1, 101]
}
```

## chords

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

## progression

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

## midi

```midi
3222 144 60 33
4750 144 62 40
4836 128 60 64
5104 144 64 49
5248 128 62 64
5689 144 67 63
5795 128 64 64
6287 128 67 64
7146 144 62 70
7549 144 64 79
7654 128 62 64
7880 144 65 63
8051 128 64 64
8310 144 69 75
8397 128 65 64
8621 128 69 64
9098 144 62 62
9100 144 65 82
9103 144 69 79
9446 128 62 64
9461 128 69 64
9475 128 65 64
9972 144 65 82
9978 144 69 70
9981 144 62 69
10315 128 65 64
10339 128 69 64
10339 128 62 64
10954 144 69 82
10958 144 62 77
10962 144 65 83
11191 128 62 64
11197 128 65 64
11236 128 69 64
```
