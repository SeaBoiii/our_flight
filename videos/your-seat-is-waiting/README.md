# Your Seat Is Waiting — RSVP trailer

A 62-second vertical (1080×1920) trailer for the Aleem & Nurulain invitation, built with
[HyperFrames](https://hyperframes.heygen.com). The guest is the hero: an invitation lights up a
phone, they walk Changi at dawn, find their window seat (21A or 22A, matching their date), lift off on the song's climax, and the clouds part
on the names. It ends on **Confirm your seat**: rsvp.aleemxnurul.love and the QR code.

## Four cuts

| Cut | Narration and text | Date | Host family | Flight | Seat |
| --- | --- | --- | --- | --- | --- |
| `en-21` | English | Saturday 21 August 2027 | The Wahabs | AN2108 | 21A |
| `en-22` | English | Sunday 22 August 2027 | The Jamals | AN2208 | 22A |
| `ms-21` | Bahasa Melayu | Sabtu 21 Ogos 2027 | Keluarga Wahab | AN2108 | 21A |
| `ms-22` | Bahasa Melayu | Ahad 22 Ogos 2027 | Keluarga Jamal | AN2208 | 22A |

`index.html` is **generated** by `scripts/cuts.mjs`; edit the script, not the file. HyperFrames
allows one root composition per project, so the cuts are produced one at a time:

```bash
node scripts/cuts.mjs ms-22     # index.html becomes the BM · 22 August cut (and re-carves the music)
node scripts/cuts.mjs           # back to EN · 21 August
npx hyperframes preview         # Studio
node scripts/render-all.mjs     # renders all four into renders/
```

`cuts.mjs` carves the music under the narration with the hyperframes-audio skill's `carve.mjs`,
which needs **ffmpeg** on PATH (`winget install --id Gyan.FFmpeg -e`). Pass `--no-carve` to skip it.

## Layout

- `compositions/frames/01–10-*.html`: one sub-composition per scene, each with its own GSAP
  timeline. Language-dependent text is exposed as composition variables; the cut generator fills
  them per scene through `data-variable-values`.
- `assets/video/`: Veo 3.1 image-to-video shots made from the invitation's art (letterbox
  cropped, re-encoded H.264). The cabin shot uses only the clean head and tail of its take;
  a sunlight flare hides the join.
- `assets/audio/vo-clyde/{en,ms}/`: narration by ElevenLabs "Clyde" (`eleven_v4`), the chosen
  narrator. `assets/audio/vo/{en,ms}/` holds the same lines read by "George"; use them with
  `--voice=george` on `cuts.mjs` or `render-all.mjs`. Placements live in `scripts/cuts.mjs` (`VO`);
  line lengths are read from the files. The bride's name is spoken "Nurul Ain".
- `assets/audio/sfx/`: ElevenLabs sound effects; placements in `scripts/cuts.mjs` (`SFX`).
- `assets/audio/music-bed.mp3`: the music, built by `scripts/music-bed.sh` from
  `untamable-love.mp3` ("Untamable Love" by Kurtz Martin, Uppbeat). Three bar-aligned sections
  (song 0–23.59 → 151.65–175.19 → 207.35–222.0, so wheels-up lands on the climax at 32.15 s) are
  gain-matched, joined with 1 s crossfades, compressed and normalised to one steady level.
  See `assets/audio/credit.md` and confirm the licence covers sharing.
- `STORYBOARD.md`, `BRIEF.md`, `frame.md`: the plan, brief and design spec.
  `boards/storyboard.html` is the sketch review board.

Never show an invitation code in any cut; the end card only reminds guests to use theirs.
