# Midnight to Daylight artwork

Created with the built-in OpenAI image-generation tool for this invitation. The tool does not expose a model name or quality selector. The nine PNG masters are preserved here; responsive delivery versions live in `public/flight/`. The aircraft retains true alpha transparency. The foreground cloud cutout is retired: the journey now renders a procedural 3D cloud volume in WebGL, with the sky artwork as its fallback. No guest information or text is embedded in the scene artwork.

## Final prompt set

All scenes requested premium photorealistic aviation/editorial imagery at the highest available quality, with midnight navy, ivory and champagne lighting; no people, lettering, logos, watermarks or interface.

- **airport-portrait.png:** Portrait 2:3 blue-hour view from an empty Singapore-style airport departure lounge through floor-to-ceiling glass to wet tarmac, distant tower and parked airliner. Quiet central negative space, restrained gold reflections and dark interior for live typography.
- **airport-landscape.png:** Landscape 3:2 counterpart, broad glass wall and architectural framing, quiet navy space on the left, apron and distant control tower, seats at lower edge and distant aircraft on the right.
- **aircraft.png:** Isolated modern four-engine double-deck passenger airliner, entire wings and tail visible, true transparent background. Ivory fuselage, navy tail and fine champagne/navy stripes, no lettering. Three-quarter front-side perspective, nose climbing to the upper right, landing gear retracted, golden sunrise lighting.
- **cabin-portrait.png:** Portrait 2:3 premium cabin, frontal view of one large oval window, warm ivory wall, gold trim and navy upholstery. Sunrise clouds outside. A centered unobstructed aperture for the scroll-driven camera move.
- **cabin-landscape.png:** Landscape 3:2 frontal cabin wall/window composition with navy seats at lower edges, subtle wood tray and warm champagne indirect light. Single central oval window showing golden clouds. Window geometry is measured in `src/sceneAssets.ts`.
- **sky-portrait.png:** Portrait 2:3 aerial sea of soft ivory cumulus clouds, creamy blue sky and champagne-peach sunrise, central negative space for the monogram, sun outside the frame.
- **sky-landscape.png:** Landscape 3:2 cloudscape with cloud banks at lower and side edges, pale sky and luminous central area, restrained natural atmosphere.
- **clouds.png:** Landscape 3:2 isolated bank of ivory cumulus clouds in the lower half, rising at both edges, transparent upper/central space and feathered alpha edges; warm right-side light and blue-gray shadows.

## Golden Hour Departure additions

The redesign added three generated masters. They were created with Google Gemini image generation (`gemini-3-pro-image-preview`) and contain no people, lettering or logos:

- **golden-portrait.png / golden-landscape.png:** Premium photorealistic aerial golden-hour photographs above a sea of ivory cumulus. Champagne, apricot and peach light comes from a low sun just beyond the right edge; the sky moves from pale champagne to dusty blue. Calm negative space is left for typography. No aircraft, wing, window, birds or text. These are used behind the arrival monogram in the journey and in the footer.
- **../stationery/wax-seal.png:** A deep teal-navy wax seal (`#0B3346`) with a gold-dusted rim and a completely blank centre, photographed from above on white. The white background was removed with a flood-fill alpha cut-out. The A&N monogram is never redrawn by the model: CSS masks the original monogram over the seal in gold.

- **../stationery/cotton-paper.png:** Generated with OpenAI `gpt-image-1.5`. A flat, evenly lit macro photograph of ivory cotton rag paper. `python scripts/prepare-paper-texture.py` removes its low-frequency lighting, makes it seamless with an offset blend and writes the near-white 512 px multiply tile `src/assets/textures/cotton-paper-512.webp` (about 14 KB).
- **../video/gate-cinemagraph-portrait-master.mp4:** Generated with Google Veo 3.1 (`veo-3.1-generate-preview`) by image-to-video. `airport-portrait.png` is both the first and the last frame, which forces a locked-off, seamless loop. The prompt asks for a calm cinemagraph of this exact scene with a tripod-locked camera: twinkling apron lights, shimmering reflections on the wet tarmac, slow distant clouds and one small aircraft taxiing far away. No people or text. Veo letterboxes the 2:3 source inside 9:16, so the delivery file crops rows 100–1179 back to 2:3, removes the audio and re-encodes. The result is a 267 KB H.264 file that matches the poster to within compression error:

  ```sh
  ffmpeg -i artwork/video/gate-cinemagraph-portrait-master.mp4 -an -vf "crop=720:1080:0:100,scale=512:768:flags=lanczos,format=yuv420p" -c:v libx264 -profile:v high -preset veryslow -crf 26 -r 24 -g 48 -movflags +faststart public/flight/gate-cinemagraph-portrait.mp4
  ```

## Phone motion layers

Two generated clips bring the journey to life on phones. Both are image-to-video from this folder's own artwork, 9:16 at 720 x 1280, with no people, text or logos. The prompts and the reasoning are in [`changes.md`](../../changes.md).

- **../video/takeoff-portrait-master.mp4:** Generated with Higgsfield (Cinema Studio Video 3.0). The first frame is `runway.png` cropped to 9:16 with `aircraft.png` placed small just above the horizon and graded toward blue hour. The airliner climbs toward a low runway camera and sweeps overhead while the camera tilts up into the night sky.
- **../video/window-sky-portrait-master.mp4:** Generated with Kling 4.0. The first frame is `sky-portrait.png` cropped to 9:16. Cloud tops glide right to left with depth parallax, as seen from a side window.

`node scripts/prepare-motion-assets.mjs` (needs ffmpeg) writes the delivery files: 40 evenly spaced 540 x 960 WebP frames in `public/flight/takeoff/`, and `public/flight/window-sky-portrait.mp4`, an 8.5 s loop made seamless by cross-fading the clip's first 1.5 s over its last.

Grain on dark scenes remains procedural SVG (`src/design/tokens.css`).

## Rebuilding delivery files

The additional **runway.png** prompt requests an exterior blue-hour-to-sunrise runway: low viewpoint, wet asphalt and warm runway lights, navy sky covering two-thirds, small distant control tower, no aircraft or glass framing, central perspective suited to a phone crop. This separates the terminal from the exterior take-off scene.

Run `python scripts/prepare-flight-assets.py` with Pillow including AVIF support. It also encodes the golden-hour scenes and the 360 px wax seal. This only resizes and encodes the masters; it performs no retouching. Run `node scripts/render-social.mjs` after installing Playwright Chromium to render the 1200 × 630 social card with exact live typography and the original monogram.

The application display monogram is a lossless WebP derivative of `public/monogram-a-and-n-display.png`. It is separate from the scene encoder above. Rebuild it from the repository root with Pillow:

```sh
python scripts/prepare-display-monogram.py
```

Keep the display PNG and original `public/monogram-a-and-n.png` unchanged. The shorter optional flight reuses the existing scene artwork; Simple view and the guest overview do not require those scenes.

## Round two additions (14 November 2026)

All generated with Higgsfield. The prompts and the reasoning are in `changes.md` at the repository root.

- **../video/golden-arrival-portrait-master.mp4:** Cinema Studio Video 3.0, image-to-video, 10 s at 720 x 1280. A slow forward glide over golden-hour cloud tops; becomes the seamless loop behind the monogram and on the goodbye screen.
- **venue-map.png:** GPT Image 2.6, 4:3. A photographed paper-craft model of the airport precinct: MRT entrance pavilion (lower left), terminal with a louvred roof (centre), link bridge and hotel around a courtyard pool (upper right). No text or people. The route, pins and labels are drawn in code.
- **../video/venue-map-loop-master.mp4:** Cinema Studio Video 3.0, 6 s, with `venue-map.png` as both the first and the last frame, locked camera: cloud shadows drift and one paper aeroplane crosses.
- **../stationery/wax-seal.png:** Replaced with a new blank navy seal (GPT Image 2.6, transparent background, alpha cleaned). The monogram is still composited in CSS.
- **../stationery/envelope-linen.png:** GPT Image 2.6, 9:16. Ivory linen with a pointed-arch pool of late sunlight.
- **../stationery/envelope-liner.png:** Cropped from the printed invitation's midnight-to-golden sky panorama, with small foil stars added in the navy.
- **../stationery/arch-window.png:** The arch window artwork of the printed boarding-pass invitation, unchanged.

Encode with `python scripts/prepare-stationery-assets.py` and `node scripts/prepare-motion-assets.mjs`.

## Round three additions (15 November 2026)

- **cruise.png:** GPT Image 2.6, 4:3, with `public/flight/aircraft-960.webp` as the reference so the livery matches. The aircraft at cruising altitude at blue hour, seen from alongside, over dark clouds that fade to navy at the bottom so the picture melts into the itinerary.
- **../video/cruise-loop-master.mp4:** Cinema Studio Video 3.0, 6 s, with `cruise.png` as both the first and the last frame: the aircraft holds its place, the clouds slide beneath it and the beacon blinks.

Encoded by the same two scripts.
