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

## Rebuilding delivery files

The additional **runway.png** prompt requests an exterior blue-hour-to-sunrise runway: low viewpoint, wet asphalt and warm runway lights, navy sky covering two-thirds, small distant control tower, no aircraft or glass framing, central perspective suited to a phone crop. This separates the terminal from the exterior take-off scene.

Run `python scripts/prepare-flight-assets.py` with Pillow including AVIF support. This only resizes and encodes the masters; it performs no retouching. Run `node scripts/render-social.mjs` after installing Playwright Chromium to render the 1200 × 630 social card with exact live typography and the original monogram.
