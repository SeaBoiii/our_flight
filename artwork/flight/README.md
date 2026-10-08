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

Grain on dark scenes remains procedural SVG (`src/design/tokens.css`).

## Rebuilding delivery files

The additional **runway.png** prompt requests an exterior blue-hour-to-sunrise runway: low viewpoint, wet asphalt and warm runway lights, navy sky covering two-thirds, small distant control tower, no aircraft or glass framing, central perspective suited to a phone crop. This separates the terminal from the exterior take-off scene.

Run `python scripts/prepare-flight-assets.py` with Pillow including AVIF support. It also encodes the golden-hour scenes and the 360 px wax seal. This only resizes and encodes the masters; it performs no retouching. Run `node scripts/render-social.mjs` after installing Playwright Chromium to render the 1200 × 630 social card with exact live typography and the original monogram.

The application display monogram is a lossless WebP derivative of `public/monogram-a-and-n-display.png`. It is separate from the scene encoder above. Rebuild it from the repository root with Pillow:

```sh
python scripts/prepare-display-monogram.py
```

Keep the display PNG and original `public/monogram-a-and-n.png` unchanged. The shorter optional flight reuses the existing scene artwork; Simple view and the guest overview do not require those scenes.
