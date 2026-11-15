# Motion upgrade: "Golden Hour Departure", phone first

14 November 2026. This note records why the journey's motion was changed, what changed, and how to adjust it. Everything here is phone-first, as asked. Tablets and desktops keep the journey they had; their versions of the new layers can come later.

## What I set out to do

The brief was to lift the 3D motion with newly generated assets, keep the same feeling, and make a guest feel carried by aeroplane to the wedding: intimate, professional, with one real "wow".

I started by filming the existing phone journey frame by frame. The story was already right: gate, boarding pass, take-off, window seat, clouds, golden hour, monogram. What held it back was that every scene was a still photograph being slid or scaled:

| Scene | Before | Why it fell short |
|---|---|---|
| Take-off | A cut-out aircraft slid across a stretched runway photograph | It read as a sticker moving over a picture, and the wide runway image was soft once cropped to a phone |
| Window seat | A still cabin with the sky baked into the window | Nothing moved, so it felt like a postcard rather than a seat |
| Through the window | Photographic window, then procedural WebGL clouds | The two looks did not match, so the "push through the glass" lost its magic |
| Boarding pass | Tilted on one axis and slid up | Flat for something meant to feel like paper in your hand |

So the plan was not to add scenes. It was to make the three moments that matter actually move, and to leave everything a guest reads untouched.

## The three moments

1. **The wow: a take-off you fly with your thumb.** The airliner lifts off in the distance with its landing lights on, climbs straight at you and sweeps overhead as the camera tilts up into the night sky. It is scrubbed by scroll, forwards and backwards, so the guest controls it.
2. **The intimate one: lifting the window shade.** The cabin now arrives dim, with the shade down and a little warm light glowing through it. As you scroll the shade rises, the light spills into the cabin, and the sky outside is alive: clouds gliding past.
3. **The continuity: one sky all the way out.** The same moving sky you saw through the window is what you fly into when the camera pushes through the glass. No change of look, then golden hour and the monogram as before.

A smaller touch: the boarding pass now dips slightly under the stamp, then banks away in depth with one foil highlight crossing it, instead of sliding off flat.

## New assets and where they came from

All clips were made from the site's own artwork as the first frame, so the palette, runway and sky are the ones already in the design.

| Asset | Made with | From | Used as |
|---|---|---|---|
| Take-off clip (6 s, 720 x 1280) | **Higgsfield**, Cinema Studio Video 3.0 | `runway.png` cropped to 9:16 with the aircraft cut-out placed just above the horizon | 40 frames, scrubbed |
| Window sky clip (10 s, 720 x 1280) | **Kling** 4.0 | `sky-portrait.png` cropped to 9:16 | An 8.5 s seamless loop |

Both shots were generated on both services so there was a choice. I picked per shot:

- **Take-off: Higgsfield.** Its take has the landing lights on and reflections on the wet runway, the approach is dead centre, and it ends on clean empty sky, which is exactly the frame the dark cabin fades in over. One caveat: seen from directly below, the aircraft reads as twin-engine for a moment.
- **Window sky: Kling.** It kept the champagne and peach palette of the existing sky artwork, which matters because it has to sit inside the photographed cabin window. The Higgsfield take is good but cooler and greyer.

The unused takes are kept in the project files (`rsvp-motion/higgsfield/` and `rsvp-motion/kling/`) and can be swapped in with one command (see "Changing a clip"). Cost: 80 Higgsfield credits and 160 Kling credits.

The Higgsfield connector available to this thread could only read the account, so the Higgsfield clips were generated through the second "Higgs" connector from a companion thread, using the same start frames and prompts.

### Prompts

Take-off: "Single continuous cinematic shot from a low camera on the runway centreline at blue hour. The white four-engine double-deck airliner with a navy tail, already airborne in the distance, climbs steadily toward the camera, growing larger and larger until it sweeps directly overhead and passes out of the top of the frame. The camera tilts up gently and smoothly to follow it into the deep navy sky. Runway edge lights glow warm on the wet asphalt, a thin band of sunrise sits on the horizon. Photorealistic, elegant, smooth constant motion, no cuts, no camera shake, no text, no logos, no people."

Window sky: "View from the side window of an airliner cruising high above a sea of soft cumulus clouds at golden hour. The cloud tops glide steadily from right to left with strong depth parallax: near clouds pass faster, distant clouds slower. Warm champagne sunlight, serene and slow, constant speed, perfectly smooth locked camera. No aircraft parts, no wing, no window frame, no birds, no text."

## How it is built

The design language had rejected scroll-scrubbed video and full 3D scenes for good reasons: big files, stuttering video seeking on iPhones, hot phones. I kept those reasons and changed the technique instead of ignoring them.

- **The take-off is not a video.** It is 40 still frames (540 x 960 WebP, 650 KB in total) drawn to a canvas. Scrolling picks the frame, and neighbouring frames are cross-faded so 40 frames read as smooth motion at any scroll speed. Only about ten frames are held decoded around the current position, so memory stays small. See `src/filmStrip.ts`.
- **The window sky is a small muted loop** (540 x 960, 447 KB), handled exactly like the existing check-in cinemagraph: it sits over the still photograph, plays only while the window is on screen, and is never scrubbed.
- **The shade, the cabin light and the 3D boarding pass are CSS only**, driven by the same single scroll value as the rest of the journey. No new library.

### It always falls back to the journey you had

Nothing new is on the critical path. Each layer switches itself on only when it is ready:

| Situation | What the guest gets |
|---|---|
| Phone, normal connection | Everything above |
| iPhone in Low Power Mode, or an in-app browser that refuses autoplay | Take-off film and shade still work; the window shows the still sky and the WebGL clouds, as before |
| A film frame fails to load | The original cut-out aircraft over the runway |
| Slow connection (3G), tablet, desktop | The original journey, unchanged |
| Data saver, 2G, reduced motion | The static invitation, unchanged, with nothing extra downloaded |

### Loading

The film frames queue behind the journey's stills during check-in, while the guest is typing their code, and boarding never waits for them. The sky loop starts downloading just after the journey opens. On a phone the new layers add about 1.1 MB, all of it deferred and none of it for low-data visits. The first screen (check-in) is unchanged.

## Timeline on a phone (scroll progress 0 to 1)

| Progress | What happens |
|---|---|
| 0.03 to 0.08 | Stamp lands; the pass dips under it |
| 0.09 to 0.18 | The pass banks away in depth, foil highlight crosses it |
| 0.15 to 0.20 | The take-off film fades in over the gate |
| 0.17 to 0.40 | Take-off, scrubbed: lift-off, approach, overhead |
| 0.40 to 0.47 | Empty night sky holds; the dim cabin fades in over it, shade down |
| 0.48 to 0.55 | The shade lifts on the moving sky; light fills the cabin |
| 0.56 to 0.82 | Camera pushes through the window into the same sky |
| 0.74 to 1.00 | Golden hour, monogram, daylight (unchanged) |

All of these numbers live in `getJourneyFrame()` in `src/journeyMotion.ts`.

## Files

New:

- `src/filmStrip.ts`: frame loader and canvas player for the scrubbed film; decides when the phone layers are allowed.
- `public/flight/takeoff/takeoff-portrait-01.webp` to `-40.webp`: the take-off frames.
- `public/flight/window-sky-portrait.mp4`: the window sky loop.
- `artwork/video/takeoff-portrait-master.mp4` and `window-sky-portrait-master.mp4`: the generated masters.
- `scripts/prepare-motion-assets.mjs`: turns the masters into the delivery files.
- `e2e/motion.spec.ts` and `src/test/filmStrip.test.ts`: tests for the new layers.

Changed:

- `src/components/Journey.tsx`: mounts the film canvas, the sky loop and the shade; skips the WebGL clouds while the loop is playing; pauses the loop when it cannot be seen.
- `src/journeyMotion.ts`: film position and opacity, shade, live-sky timing and the boarding pass's 3D values.
- `src/journey.css`: the film, living window, shade, cabin light and boarding-pass styles.
- `src/sceneAssets.ts`, `src/preload.ts`: asset names and the queued film preload.
- `scripts/check-artifact.mjs`, `scripts/check-mobile-performance.mjs`: the "no video in the journey" rule now allows exactly this one loop (600 KB limit) and budgets the film (800 KB limit).
- `e2e/clouds.spec.ts`, `e2e/redesign.spec.ts`, `e2e/helpers.ts`: the WebGL cloud tests now block the new layers on purpose, so they keep testing the fallback journey.
- `DESIGN_LANGUAGE.md`, `artwork/flight/README.md`: updated to match.

## Changing a clip

Put the new MP4 over the matching file in `artwork/video/` and run, with ffmpeg installed:

```sh
node scripts/prepare-motion-assets.mjs
```

It rewrites the 40 frames and the loop. `TAKEOFF_START` and `TAKEOFF_END` (seconds) trim the ends of the take-off clip if needed.

## Checked

- Unit tests: 482 pass (8 new).
- Phone end-to-end tests: the three new motion tests pass, and the existing journey, cloud and redesign suites pass at 390 x 844. Screens compared against the original build at the same size were pixel-identical where the tests take snapshots (check-in, boarding, journey opening, itinerary, RSVP).
- Production build and `npm run check:artifact` pass.
- Lint and type-check are clean.

Not checked: a real iPhone or Android phone. Everything was run in Chromium at phone sizes, so please scroll the journey once on your own phone, in normal mode and in Low Power Mode. The snapshot baselines in the repo are Windows ones; if `npm run test:e2e:mobile` reports a difference on `journey-opening`, look at it and run `npm run test:e2e:update`.

## Round two: arrival, envelope, map and everyday comforts

14 November 2026, later the same day. Everything in this round is in one pull request and is not live until it is merged.

### What you asked for, and what changed

| You asked | What changed |
|---|---|
| "02 / Above the clouds" almost disappears as the cabin lights up | The caption now carries its own soft pool of dusk that fades in exactly as the shade lifts, and the label warms to a brighter gold with a fine dark edge. The first lit frame is as readable as the dark one. |
| Improve the envelope so it feels like the printed invitation | Rebuilt. See below. |
| A better "Getting here" map with better motion | Rebuilt as a living paper model. See below. |
| Look at the whole invitation and improve quality of life | Four additions, listed below. |
| Translucent top and bottom navigation bars, like Apple's liquid glass | Done. See "Liquid glass navigation" below. |
| (Chosen on the card) A living golden-hour arrival | The sky behind the monogram is now a slow glide over golden clouds instead of a photograph, and the same sky returns on the goodbye screen. |

### The envelope

The old envelope was flat ivory shapes on flat ivory. The printed card you designed has four things that make it feel like yours: the pointed arch window, midnight fading to golden hour, the navy wax seal with the gold monogram, and the boarding-pass layout. The envelope now uses all four.

- **Light through an arch window.** The envelope lies on ivory linen, and a pointed-arch pool of late sunlight fades in across the cloth as the scene begins.
- **A real seal.** A new photographed navy wax seal with a gold-dusted rim. The monogram is still pressed in from your own file, so the lettering is never redrawn by an image model.
- **A night-sky liner.** The flap has a softly curved point and two real faces. As it turns over, it shows a midnight liner with foil stars that runs down into the envelope and ends in a golden horizon, so the card rises out of golden hour.
- **The card is the invitation.** The card that rises is a small version of the printed boarding pass: arch window with the aircraft breaking the frame, "You are cordially invited", the names stacked, the guest's name when known, and SIN to FOREVER.
- It waits out of sight in the pocket until the flap is open, a few gold stars lift out with it, and it comes forward into the formal invitation.

It is still plain HTML and CSS moved by scroll, so it is sharp on every screen and works on tablets and desktops too. The three photographs (linen, liner, arch window: 44 KB together) load only as the scene draws near. Until then, and if they fail, paper tones stand in.

### Getting here

The line drawing became a photographed paper model of the airport: the MRT station entrance, Terminal 3 with its louvred roof, the link bridge and the hotel around its pool, with the control tower and an aircraft behind.

- **The walk draws itself** in gold as you scroll, with a small light travelling along it. The three stops (1 Changi Airport MRT, 2 Terminal 3, 3 Crowne Plaza) light up in turn, on the model and in the legend, and the hotel pin gives a soft pulse on arrival.
- **The model is alive.** A 6 second muted loop (252 KB) adds drifting cloud shadows and one paper aeroplane gliding over. It was generated with the same picture as its first and last frame, so it loops without a seam and the pins never move.
- **Tapping the model opens Google Maps.** There is a small arrow in the corner as a cue.
- It is a model, not a survey. The written directions and the buttons stay the source of truth.

The loop plays only while the map is on screen, and only with motion allowed on a good connection. Otherwise the still and the complete route are shown.

### Everyday comforts

- **Skip flight.** Once the journey is under way a small "Skip flight" control appears under the top bar. It lands on the invitation at once without fast-forwarding the film, and it is gone by the arrival. It is a real link, so keyboards and screen readers can use it.
- **Tap the envelope.** A tap opens it: the page glides through the opening by itself, and any touch, scroll or key hands control back. The hint now reads "Tap or scroll to open".
- **Tap the map** for directions, as above.
- **A living goodbye.** "Thank you for flying with us" now sits over the same moving golden-hour sky as the arrival (phones only; the file is already downloaded by then).

- **Short phones.** On phones about the height of an iPhone SE, the boarding pass on the first screen used to cover "Scroll to take flight" when the Malay two-day pass was shown. The opening now tightens on short screens so the guidance always sits clear below the pass.
- **Data saver.** Guests on data saver or a slow network get the walk drawn on plain chart paper. The paper-model photograph is not requested at all, in keeping with the rule that low-data mode fetches nothing from the flight artwork.

### Liquid glass navigation

The top controls (back, monogram, music, language), the bottom dock (Itinerary, Directions, Check in), the flight tracker pill and the "Skip flight" control are now one material: a smoked navy pane.

- **What makes it read as glass.** The pane is half transparent, blurs what passes beneath it (20 px), deepens and saturates it, and carries a bright upper rim with a faint diagonal sheen where it would catch the light. Over the night scenes it is nearly clear. Over the ivory paper it turns to smoked glass, so the page stays visible through it.
- **Why smoked rather than clear.** The labels are small gold capitals. A clear pane over ivory paper would wash them out, so the pane dims its backdrop enough to keep the labels at a comfortable contrast (about 5 to 1 over paper, more over navy).
- **One recipe.** It is defined once as five tokens in `src/styles.css` (`--glass-tint`, `--glass-fill`, `--glass-filter`, `--glass-border`, `--glass-edge`), so the feel can be tuned in one place. Raising the tint's last number makes it more solid; lowering it makes it clearer.
- **Fallbacks.** Browsers that cannot blur get a solid navy pane, and guests who ask their phone for reduced transparency get the same.
- **Unchanged.** Sizes, positions and behaviour are the same, and the gold "Check in" stub stays solid foil because it is the one action the dock exists for.

### New assets in this round

| Asset | Made with | Used as |
|---|---|---|
| Golden-hour arrival clip (10 s, 720 x 1280) | **Higgsfield**, Cinema Studio Video 3.0, from the prepared start frame | An 8.5 s seamless loop, 391 KB |
| Paper model of the airport (4:3) | **Higgsfield**, GPT Image 2.6 | The map still, 55 to 66 KB |
| Living map loop (6 s) | **Higgsfield**, Cinema Studio Video 3.0, same first and last frame | A seamless loop, 252 KB |
| Linen with arch-window light | **Higgsfield**, GPT Image 2.6 | Envelope backdrop, 10 KB |
| Blank navy wax seal | **Higgsfield**, GPT Image 2.6, transparent | Envelope seal, 18 KB |
| Night-sky liner and arch window | Your printed invitation's Higgsfield art (sky panorama, arch window) | Envelope liner and card, 33 KB |

Cost: about 97 Higgsfield credits (50 arrival clip, 30 map loop, about 17 for four images; one of the four, an illustrated map, was not used). Originals are in the project files under `rsvp-motion/round2/`.

Prompts, for retakes:

- Arrival: "Aerial view high above a sea of soft cumulus clouds at golden hour, looking toward the horizon. The camera glides forward very slowly and steadily over the cloud tops toward the warm glow of the low sun at the right edge of the horizon. [...] one continuous shot, no cuts, no camera shake. No aircraft, no wing, no window frame, no birds, no lens flare streaks, no text."
- Map: "Photograph of an exquisite handmade paper-craft miniature diorama of a modern airport precinct, seen from a high three-quarter aerial angle [...] bottom-left a small underground train station entrance pavilion; centre a large airport terminal with a sweeping roof of small square skylight louvres; upper-right a contemporary four-storey hotel with a lattice facade around a courtyard pool; a slim covered bridge connects them [...] No text, no people, no trees, no route line."
- Map loop: "Locked-off static tripod shot [...] Soft shadows of passing clouds drift slowly across the paper ground. A tiny folded paper aeroplane glides across the scene from the left edge to the right edge and leaves the frame. [...] The final frame is identical to the first frame."

### Files in this round

- `src/components/Envelope.tsx`, `src/experience.css`: the new envelope.
- `src/components/VenueMap.tsx`: the paper model, route, stops and legend.
- `src/components/LivingLoop.tsx` (new): one small component for "a muted loop over a still that loads near, plays in view and removes itself if it cannot play". Used by the map and the goodbye sky.
- `src/components/Journey.tsx`, `src/journey.css`, `src/journeyMotion.ts`: arrival loop (asset tier 3), caption backdrop, skip control.
- `scripts/prepare-stationery-assets.py` (new): encodes the envelope and map pictures. `scripts/prepare-motion-assets.mjs` now also builds the arrival and map loops.
- `scripts/check-artifact.mjs`: allows the two new loops, with budgets of 600 KiB and 500 KiB.
- `e2e/motion.spec.ts`: five new tests (arrival sky, envelope, map, map without its loop, the comforts).
- `src/styles.css` (glass tokens), `src/dock.css`, `src/experience.css`, `src/journey.css`: the liquid glass navigation and the short-phone opening.

### Checked in this round

- 483 unit tests, type-check and lint pass.
- End-to-end tests in Chromium at four phone sizes: 117 pass. The 20 that do not are the five picture-comparison tests per phone size, which only have Windows baselines and cannot be compared on the Linux machine this was built on. Those baselines will need refreshing on Windows with `npm run test:e2e:update`, because the navigation, envelope and map all look different by design.
- The full run caught two things, both fixed: the new map picture was being fetched in data-saver mode, and on short phones the Malay two-day pass covered the scroll guidance (that one was already present before this round).
- Production build and `npm run check:artifact` pass.
- Not checked: Safari and real phones, as before. The envelope's two-faced flap uses 3D transforms that deserve a look on an iPhone in particular.

## Not done, and worth doing next

- **Desktop and tablet versions** of the take-off film and the window sky (landscape clips), as agreed to follow later.
- **A retake of the take-off** if the twin-engine moment bothers you. The start frame and prompt above will reproduce the shot.
