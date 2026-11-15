# Design language: Golden Hour Departure

A luxury editorial travel story that runs from **midnight to golden hour**. It is printed on cotton paper, foil-stamped in champagne gold, edged with a songket motif, and told by scrolling. The invitation is designed for phones first (390 × 844, then 360 and 412) and enriched for tablets and desktops.

## Why this direction

| Choice | Reason |
|---|---|
| **Keep and lift "Our Flight"** | The venue is at Changi Airport. The monogram already carries a cloud flourish, and flight codes and cabin classes decide which events each guest is invited to. The redesign keeps that identity but moves it from *airline app* to *heritage luxury travel*: first-class stationery, departures boards and golden-hour skies. |
| **Midnight → golden hour → daylight** | A sunrise is the visual meaning of a new beginning. Scrolling moves time forward, so motion has a purpose instead of decorating. |
| **Editorial serif, not script** | Large, tightly tracked serifs read as premium and stay legible for older guests on small screens. Instrument Serif carries display text; script calligraphy is avoided. |
| **Palette sampled from the monogram** | Navy `#033A4E` and gold `#D9B472` are taken from the A&N mark itself, so the site and monogram match exactly. They are joined by cotton ivory and a golden-hour ramp. |
| **Songket *pucuk rebung*** | The bamboo-shoot motif of Malay songket stands for growth and new beginnings. It appears only as a fine gold edge or a faint lattice: one repeated motif, used with restraint. |
| **Tactile stationery** | Paper grain, foil, perforations, a wax seal and ink stamps make a digital card feel precious. They also map interactions onto gestures everyone knows: tear the stub, break the seal, stamp the pass. |
| **Kinetic, scroll-scrubbed type** | Type that responds to scroll directs attention, and because it is scrubbed rather than autoplayed, each guest controls the pace. |
| **Split-flap departures board** | The most recognisable airport typography gives check-in and the itinerary a memorable moment, while the information underneath stays plain text. |

**Rejected:**
- **Florals and script:** dated and hard to read.
- **Scroll-scrubbed video and full 3D scenes:** 10–30 MB clips, iOS seeking stutter and hot phones. The take-off is therefore scrubbed from 40 still frames on a canvas, never from a video.
- **Smooth-scroll hijacking such as Lenis:** it fights native touch scrolling and accessibility.
- **ScrollTrigger pinning:** CSS `position: sticky` is smoother on iOS.

There are four videos, all small, muted, autoplaying loops: the check-in cinemagraph, the living cabin window and the golden-hour arrival (phones only; the arrival loop is reused on the goodbye screen), and the living venue map (any screen with motion and a good connection). Each is a progressive layer over a still photograph, never scrubbed and never on the critical path. If autoplay is refused, the still stays.

## Tokens

All tokens live in [`src/design/tokens.css`](src/design/tokens.css).

- **Colour:** `--midnight`, `--navy-deep`, `--navy` (monogram), `--ivory`, `--paper`, `--sand`, `--gold` (monogram), `--gold-deep`, `--gold-text` (AA contrast on ivory), the `--dawn-*` ramp and `--gold-foil`.
- **Type:**
  - Instrument Serif for display.
  - IBM Plex Mono 500 for flight data, boards and labels.
  - The system sans for body text.
  - Amiri for the Bismillah.
  - All four are self-hosted, and each font's OFL licence file sits next to it.
- **Limits:** display text tops out around 6–6.5 rem, and tracking is never tighter than −0.04 em.
- **Surfaces:**
  - **Paper:** every paper surface (passes, envelope, invitation card, postcards, map, RSVP) multiplies a generated, seamless cotton-paper tile (`--paper-texture`, 14 KB) over its own ivory, so tints are preserved.
  - **Grain:** procedural grain (`--grain`) is kept for dark scenes.
  - **Songket:** the border and lattice are inline SVG data URIs, which the CSP already allows.
- **Foil:** lettering on paper uses `--gold-foil-ink`, which rests in deep gold so every letter stays legible. The bright highlight only sweeps across once.
- **Elevation:** declared once, as a tinted soft shadow (`--shadow-paper` or `--shadow-lift`). Cards stay at 12–16 px radii. Blur is used only on the fixed navigation, which is one liquid-glass material: a smoked navy pane (`--glass-fill`, `--glass-filter`, `--glass-border`, `--glass-edge` in `src/styles.css`) shared by the top controls, the bottom dock, the flight tracker and the skip control. It turns solid where blur is unsupported or reduced transparency is requested.

## Motion

- **One engine.** GSAP 3.15 (free for commercial use) with ScrollTrigger and SplitText. A single ScrollTrigger drives the cinematic journey through the existing `getJourneyFrame()` math. Scene timelines drive the envelope, story, itinerary and venue.
- **GSAP never loads on check-in.** That page uses a few one-shot CSS keyframes and a requestAnimationFrame split-flap.
- **Scroll is time.** Scenes are scrubbed. Each chapter has one hero moment, then the page lets the guest read.
- **Easing.** Exponential ease-out (`expo.out`), with no bounce or elastic curves. The only overshoot is the physical RSVP stamp.
- **Transform and opacity only** in scroll scenes. Clouds stop drawing once the golden-hour sky fully covers them.
- **Phone motion layers.** On phones the take-off is a scroll-scrubbed film (`src/filmStrip.ts`), the cabin window shows a looping sky behind a shade that lifts, and the boarding pass banks away in depth. Each layer switches on only once it is ready and otherwise leaves the original still, cut-out aircraft or WebGL clouds in place. Tablets and desktops keep the original journey for now. See [`changes.md`](changes.md).
- **Reduced motion, low data and no IntersectionObserver** keep the existing static journey. No GSAP scene runs, and the content is fully visible in its natural CSS state.

## Chapters

| # | Chapter | Hero moment |
|---|---|---|
| 0 | Check-in | Split-flap board (`AN2108 ↔ AN2208 → FOREVER · ON TIME`). The flight code loops between both wedding days the way a real board turns: forward round the digit wheel, so 1 → 2 is one flip and 2 → 1 rolls 3…9, 0, 1. Letter-by-letter names appear over midnight Changi. On phones, a seamless cinemagraph brings the photograph to life. The code form sits in the thumb zone. |
| 1 | Boarding pass | Cotton-paper pass with a foil "A&N" and an optional **Board with music** switch. A tap sweeps the scanner beam, the stub tears along the perforation with a haptic tap, and the pass lifts away. |
| 2 | Journey | Runway → take-off → cabin → window → clouds → **golden-hour sky** → monogram. Kinetic line-masked captions and a SIN → FOREVER route HUD. On phones the airliner lifts off toward the guest and sweeps overhead as they scroll, the window shade lifts on a moving sky, and that same sky carries through the window. |
| 3 | Envelope | Styled after the printed boarding-pass invitation: arch-window light on linen, the navy wax seal lifts, the curved flap turns over on a night-sky liner and a small boarding-pass card with the arch window rises out of the golden horizon. A tap opens it too. It is decorative; the formal invitation that follows carries the words. |
| 4 | Invitation | Bismillah, salam and the formal invitation, revealed line by line; names flip in letter by letter. |
| 5 | Our story | Quote inks in word by word; the flight line draws itself; three postcards stack as you scroll. |
| 6 | Itinerary | Departures board: heading letters flip in, and timeline dots light up as each item scrolls past. |
| 7 | Getting here | A paper model of the airport (MRT → T3 → Crowne Plaza): the walk draws itself in gold, the three stops light in turn, a muted loop adds cloud shadows and a paper aeroplane, and tapping the model opens Google Maps. With **Get directions** and **Copy address**. |
| 8 | RSVP | Large choice cards and a −/+ party-size stepper. Confirmation shows a **CONFIRMED** stamp and a short burst of paper planes and petals. |
| 9 | Arrival | Golden-hour sky with "Thank you for flying with us", device controls and the music credit. |

## Performance strategy: warm the plane during check-in

Guests spend 10–40 seconds entering their code. [`src/preload.ts`](src/preload.ts) uses that time in stages:

1. After the check-in page has rendered, it fetches the invitation, journey and GSAP code.
2. It then fetches only the journey artwork for the current screen (AVIF when supported).
3. On the boarding screen it decodes those images and pre-compiles the cloud shader.
4. When the guest boards, the opening scenes are already decoded. If they aren't, boarding waits at most 700 ms more, never longer.

Low-data visits download nothing extra, reduced-motion visits skip the artwork, and returning guests warm up only when they tap **Replay**.

On phones the take-off film (40 frames, about 650 KB) queues behind those stills and boarding never waits for it. The window sky loop (about 450 KB) is requested once the journey has opened. The measurements below predate these two layers; re-run `scripts/check-mobile-performance.mjs`, which now budgets the film separately.

Lab measurements at 390 × 844 on throttled 4G (1.6 Mbps, 4× CPU slowdown):

| Measure | Result |
|---|---|
| LCP | 0.5 s |
| Check-in usable | 1.0 s |
| Critical transfer | 249 KB |
| Deferred downloads (journey plus the 267 KB check-in cinemagraph) | 518 KB |
| Whole journey preloaded by | 4.6 s, well inside the time guests spend typing their code |

## Music

Music is opt-in only. The guest turns it on with the **Board with music** switch, or later from the navigation toggle.

- **Track:** "Untamable Love" by Kurtz Martin via Uppbeat, credited in the footer.
- **Delivery file:** a 128 kbps copy at [`public/audio/our-song.mp3`](public/audio/our-song.mp3), about 3.7 MB, which streams progressively. The master is kept in `artwork/audio/`.
- **Behaviour:**
  - Nothing autoplays.
  - Playback pauses when the page is hidden and fades out at the RSVP form.
  - The choice is stored under `our-flight:music`, and **Forget this device** clears it.
