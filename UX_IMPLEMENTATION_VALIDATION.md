# Original invitation restoration - 27 September 2026

The current local implementation restores `cda7f32` as the visual baseline while retaining remembered access, reliable RSVP recovery, deferred media and text reflow fixes. No deployment or live RSVP submission was performed.

## Implemented

- First visit: code, original boarding-pass overview, original scan interaction, then the complete ticket/stamp and flight journey. The original 600svh mobile / 700svh desktop pacing, formal invitation, full story and closing are restored.
- Remembered visits open directly at the itinerary. Inline **Replay our full invitation** opens the full journey immediately. Back returns to the itinerary after replay and the boarding pass after a first visit; browser Back/Forward and native RSVP fragments remain supported.
- Removed the guest overview/countdown, manual Simple view controls, persistent navigation dock and itinerary-card calendar/directions buttons. Venue directions and calendars for confirmed attending events remain.
- Successfully acknowledged RSVPs save a version-2 receipt with an optional validated, trimmed full `guestName`. Version-1 nameless receipts remain valid. The greeting, passenger name and replay salutation use only a confirmed name for the active invitation fingerprint. A different guest's RSVP and Forget this device clear the earlier personal greeting. Personal messages stay excluded from receipts.
- Existing uncertain-response identity and unchanged retries, receipt recovery, fingerprint isolation and blocked-storage visit memory remain. Backend and submission protocol are unchanged.
- One-day invitation labels use Wedding Reception / Resepsi Perkahwinan, including Nikah when applicable. Both-day invitations keep specific Bride/Groom headings. A central presentation clone supplies tickets, itinerary/programme, RSVP, confirmations and calendars without modifying shared event definitions.
- Six new single-day calendar resources supplement the original six URLs. Dates, times, eligibility, event IDs, calendar UIDs, Asia/Singapore time zone and separate Nikah details are unchanged.
- Automatic reduced-motion, low-data and unsupported-browser fallbacks remain; cinematic modules and media stay deferred on remembered visits. The original monogram master is untouched and the lossless display WebP is retained.

## Validation

| Check | Result |
| --- | --- |
| `npm test -- --reporter=dot` | 262 tests passed across 18 files |
| `npm run lint` | Passed |
| `npm run build` | TypeScript and production build passed |
| `npm run check:artifact` | Passed; 44 artifact files including twelve calendars, protected monogram integrity verified |
| Mobile guest flows, four phone projects | 57 passed, 3 intentional duplicate-desktop skips |
| Launch/recovery flows, four phone projects | 28 passed, 12 intentional duplicate-case skips |
| Design/receipt/accessibility, Chromium and WebKit | 20 passed |
| Cloud rendering/GPU recovery, Chromium and WebKit | 6 passed |
| Screenshot regression | All 32 active baselines passed without updating snapshots |
| Complete original/restored flight comparison | 12 phase pairs reviewed at 390x844 and 1440x900 |
| `git diff --check` | Passed |

Unit coverage includes every invitation profile in both languages, source-event immutability, new/original calendar URLs and invariant UIDs/times, verified names, version-1 receipts, malformed optional names, shared-device resets, blocked storage, credentials/history and unchanged retry behavior.

All four restored mobile flight-opening screenshots are pixel-identical to the `cda7f32` baselines. Manual local review checked the original boarding pass, stamp, return itinerary, named welcome, and Malay static invitation at 320px with 200% text. The complete phone/desktop comparison used 24 actual screenshots covering ticket, chop, takeoff, cabin, window and arrival. Ticket through window were pixel-identical at both widths (10 pairs). Arrival composition, text and clouds matched; the only small pixel differences were within the optimized display monogram. Both renderers used WebGL for window captures; all artwork loaded, with no console errors or horizontal overflow. See the local [comparison report](outputs/qa/full-journey-comparison/REPORT.md), [phone contact sheet](outputs/qa/full-journey-comparison/phone-contact-sheet.png) and [desktop contact sheet](outputs/qa/full-journey-comparison/desktop-contact-sheet.png).

The final browser coverage totals **111 passing cases** (98 Chromium, 13 WebKit) and 15 intentional duplicate-case skips. Browser cases include first/remembered visits, direct replay, Back/Forward, all eight invitation profiles in both languages, confirmed-name privacy/isolation and resets, older nameless receipts, blocked storage and exact uncertain retries, failed chunks/artwork, automatic low-data/reduced-motion fallback, all twelve calendar HTTP resources, keyboard navigation, 320px/200% text and automated accessibility scans. Responsive inspection also covers 360, 768 and 1440px and landscape. Initial stale test expectations for the removed overview and restored static welcome were updated; final assertions passed without application changes.

Browser outputs are retained locally under `outputs/qa/restoration-mobile-final`, `restoration-clouds`, `restoration-redesign`, `restoration-redesign-followup` and `restoration-launch-remaining`. The temporary original-baseline worktree/server were removed after comparison. The submission-disabled preview on port 4175 remains running.

## Local review and remaining device checks

Run `npm run dev:demo` and open **http://127.0.0.1:4175/**. Public test code **E2EBRIDE03** shows one day including Nikah; **E2EGROOM03** shows both days; **E2EBRIDE01** shows one reception-only day. Reload after check-in to see the direct returning itinerary. This preview disables RSVP submission. Automated browser tests exercise successful names using a locally fulfilled fake receipt bridge.

No live RSVP, deployment, physical iPhone/messaging-app calendar handoff or fresh Lighthouse/Core Web Vitals measurement was performed. Playwright WebKit covers the engine; native Calendar handoff remains a physical-device check. The in-app browser connection and 21st CLI were unavailable, so verification uses installed Playwright Chromium/WebKit and existing project components.
