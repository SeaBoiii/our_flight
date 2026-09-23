# Midnight to Daylight — local validation

Reviewed on 23 September 2026. Implementation is ready for local design review. Nothing has been published or pushed.

## Preview

Run `npm run dev:demo`, then open **http://127.0.0.1:4175/** with demo code **E2EGROOM03** for both events, or **E2EBRIDE01** for the bride's reception only. This isolated server ignores local environment credentials and disables RSVP sending. Reload after check-in to try returning-guest Fast Track.

The production build can be reviewed separately with `npm run preview -- --host 127.0.0.1 --port 4180`. It uses the existing local environment configuration. Publishing remains separate: pushing the production branch triggers GitHub Pages deployment.

## Delivered

- Blue-hour check-in; ivory and navy boarding passes; five native-scroll phases from ticket lift through takeoff, cabin, window and daylight monogram. The sticky section spans 600svh on phones and 700svh at tablet/desktop widths.
- Editorial invitation and Our Story, readable departure-board itinerary, always-visible venue/address/directions, expandable transport guidance, reply card and distinct attending/declining/mixed confirmations.
- Top back/language controls, heading focus and browser history, returning-only Fast Track, and no-cinematic-media fallbacks for reduced motion, data saver and unsupported IntersectionObserver. The floating Itinerary/RSVP shortcuts are temporarily removed at the user's request; guests scroll to those sections after the journey.
- Responsive AVIF/WebP scenes and a transparent aircraft layer, progressively loaded after boarding. Real 3D clouds replace the mirrored foreground cutouts: a procedural WebGL volume uses rounded cloud clusters, sunlight, depth haze and a scroll-controlled camera. Perspective follows the viewport, with 220,000-pixel phone and 400,000-pixel desktop drawing budgets. No downloaded cloud texture or 3D library is needed.
- Tapping keeps the ticket scan. The circular Singapore/A&N chop lands during the first part of the scroll journey (2.5–7.5%), before the ticket lifts away (8.5–18%). Reversing scroll reverses the chop. The compact reduced-motion composition omits it. Unavailable/lost WebGL exposes the existing sky fallback, with context restoration supported. Retired cloud video and cutouts are excluded from the build. Failed artwork leaves gradients, readable text and working navigation.
- Self-hosted Instrument Serif, retained Amiri and system body font, refreshed social card and navy browser theme. Original monogram master remains byte-identical.

The invitation catalogue, religious/personal copy, programme, access credentials, deadline, storage, calendar semantics, RSVP fields, submission implementation and backend contract are unchanged. No people or couple photographs were generated. Artwork masters, prompt descriptions and rebuild instructions are in [artwork/flight/README.md](artwork/flight/README.md). The built-in image generator has no exposed Sunburst/model/max selector.

The visual references were [Singapore Airlines Suites](https://www.singaporeair.com/en_UK/pl/flying-withus/cabins/suites-and-first-class/suites/) for cabin materials and [Apple's AirPods presentation](https://www.apple.com/airpods-pro/) for large-scale visual storytelling. The invitation artwork and live interface were created for this site.

## Measured budgets

| Measurement | Result | Target |
| --- | ---: | ---: |
| Initial JavaScript, gzip | 72.4 KiB | ≤150 KiB |
| Existing initial artifact estimate | 455.8 KiB | ≤500 KiB |
| Actual initial mobile transfer, including fonts/images | 254.6 KiB maximum | ≤500 KiB |
| Selected mobile artwork, AVIF + transparent WebP | 180.3 KiB | ≤2 MiB |
| Selected mobile artwork, WebP fallback | 240.9 KiB | ≤2 MiB |
| Mobile LCP | 1.428 s median | <2.5 s |
| Mobile CLS | 0.000223 maximum | <0.1 |
| Enabled check-in rendered | 1.433 s median | supplementary measurement |

Three cold Chromium runs used a 390 × 844 viewport, 1.6 Mbps download, 750 Kbps upload, 150 ms latency and 4× CPU slowdown against the production preview. LCP identifies the live couple-name element. These are local lab results, not physical-device or field measurements. Full raw measurements are in the ignored [outputs/qa/performance/metrics.json](outputs/qa/performance/metrics.json).

An isolated hardware-rendered Chromium check of the new cloud shader measured approximately 2.0 ms per phone-sized frame and 2.3 ms per desktop-sized frame on this workstation (six samples per size after warm-up, synchronous pixel readback included). Headless Chromium otherwise uses software rendering here; its frame timings are not representative of hardware WebGL. These small desktop-GPU measurements do not establish sustained mobile frame rate or battery cost. The runtime renders only on changed scroll/size, suspends while hidden/offscreen and skips 3D entirely for reduced motion, data saver and Fast Track.

Visual WebKit review caught a canvas compositing failure after resizing, despite valid GPU pixels. The renderer now retains a fixed square backing buffer for each canvas, including context restoration, while updating the camera's aspect ratio. This avoids repeated allocation and keeps the 3D view correctly painted through resizing and orientation changes. Chromium and WebKit captures were reviewed after this fix.

Reproduce after a production build and starting the preview on port 4180:

```sh
npm run check:artifact
node scripts/check-mobile-performance.mjs
```

`PERFORMANCE_URL` can select a different production preview address. The artifact checker validates delivery assets, both mobile image budgets, initial budgets, original monogram integrity and private-value exposure, and rejects retired video assets.

## Verification

- ESLint, TypeScript production build and artifact checks pass.
- **188 unit/contract tests pass**, including all eight profiles, event scopes, calendars, confirmed and duplicate receipts, unconfirmed retries, language changes during retry, drafts, blocked storage and late receipts. Cloud tests cover deferred initialization, duplicate-frame suppression, stable buffers through resize/context restoration, reverse scrolling, offscreen/hidden suspension and resource cleanup. Ticket tests preserve tap-to-scan; motion tests verify the scroll chop settles before lift and reverses correctly.
- Browser regression: **92 checks pass across the full run and final focused reruns; 6 duplicate viewport checks are intentionally skipped**. The final full run passed 90 checks; two text-enlargement checks found hidden chop markup in the static composition. That markup is now omitted there, and all eight affected Chromium/WebKit checks pass on rerun. Coverage includes 200% Malay text, actual WebGL pixels, unavailable-WebGL fallback, context loss and restoration. Cloud captures cover 360, 390, 412, 430, 768 and 1440px plus landscape, forward and reverse progress. The existing screenshot baselines still pass.
- All eight profiles pass browser checks in both engines. Other coverage includes first/returning visits, Fast Track without cinematic requests, history and heading focus, calendar HTTP responses, attending/declining/mixed RSVP, receipt confirmations, reduced motion, saveData/2g/slow-2g, failed artwork and failed experience chunks.
- Automated axe WCAG A/AA checks report **zero violations** on check-in, boarding and the full static invitation in Chromium and WebKit.
- Visually reviewed layouts at 360, 390, 412, 430, 768 and 1440px, each cinematic phase, reverse scrolling, landscape opening/window geometry, Malay text enlargement, and a simulated 390 × 400 keyboard viewport. Form inputs remain readable; the floating dock is now absent throughout the experience.
- Reviewed replacement Windows screenshot baselines. Component captures exclude fixed navigation where needed to inspect full cards; real viewport captures separately verify the visible controls. Visual review caught and corrected aircraft framing and enlarged ceremonial-ticket text clipping.
- Demo preview checked with two-event eligibility, visible preview status and disabled submission.

Run `npm run test:e2e` after `npx playwright install chromium webkit`. Set `E2E_PORT` if the default port 4173 is occupied. The suite starts an isolated fixture server and mocks Google receipts; it never needs production guest codes or real submissions.

Useful local review artifacts:

- [Full browser captures](outputs/qa/final/)
- [Final regression captures](outputs/qa/scroll-chop-final/)
- [Verified final cloud/chop and enlarged-text reruns](outputs/qa/scroll-chop-verified/)
- [3D clouds and scroll chop captures, including WebKit resize fix](outputs/qa/cloud-stable-final/)
- [Final orientation captures](outputs/qa/orientation-final/)
- [Enlarged Malay ticket captures](outputs/qa/enlarged-final/)
- [Checked-in visual baselines](e2e/mobile.spec.ts-snapshots/)
- [Social preview](public/og.jpg)

## Still unverified outside this workspace

Physical iPhone Safari and Android Chrome, actual software keyboards and changing browser bars/notches, messaging-app browsers, native Calendar handoff and sustained scroll frame rate need device checks. Playwright WebKit provides engine coverage but is not a physical Safari test. Live Apps Script writes/receipts, deployed-network performance and social-platform cache refresh were not exercised; backend tests used the existing contract with mocked receipts. No deployment was performed.
