# Aleem & Nurulain — Our Flight

A mobile-first Vite/React wedding invitation for a static GitHub Pages site. The configured guest URL is:

`https://rsvp.aleemxnurul.love/`

The A&N monogram, boarding-pass designs, ticket scan, Midnight to Daylight flight journey, bilingual invitation, itinerary, calendar actions and RSVP are shared across all invitations. The invitation side and cabin class derived from the entered code determine what the guest receives:

| Invitation side | Cabin class | Invitation scope |
| --- | --- | --- |
| Groom | Economy | 22 August Wedding Reception |
| Groom | Premium Economy | 22 August Wedding Reception |
| Groom | Business | Full 21 August programme and 22 August Groom's Reception |
| Groom | First Class | Full 21 August programme and 22 August Groom's Reception |
| Bride | Economy | 21 August Wedding Reception only |
| Bride | Premium Economy | 21 August Wedding Reception only |
| Bride | Business | 21 August Nikah & Wedding Reception |
| Bride | First Class | Full 21 August programme and 22 August Groom's Reception |

There is no side or class selector. Codes are normalized with Unicode NFKC, trimmed, uppercased, and stripped of spaces and hyphens before hashing. A version-4 record in `localStorage` remembers the invitation on that browser/device without an expiry. Every reload verifies its credential against the current configured hashes and checks the derived side, class and fingerprint before restoring access. Invalid records, changed access configuration, and disabled legacy credentials return to check-in. Browsers that block storage can still use the current visit.

Old `sessionStorage` access records are discarded; those guests check in once to begin persistent access. RSVP drafts and verified receipts use separate fingerprint-based local-storage keys. Switching invitations preserves them; the explicit **Forget this device** action removes them.

## Design language

The frontend follows **Golden Hour Departure**: an editorial travel story from midnight Changi to golden hour. It uses cotton-paper stationery, champagne-gold foil and a songket *pucuk rebung* edge, and is designed for phones first. [DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md) records the reasoning, tokens, chapters, motion rules and performance strategy. GSAP (ScrollTrigger and SplitText) is the only animation engine, and check-in never loads it. Design tokens live in `src/design/tokens.css`.

## Guest journey and remembered invitations

See [27 September implementation validation](UX_IMPLEMENTATION_VALIDATION.md) for the current changes, browser coverage and remaining device checks.

First check-in shows a split-flap departures board above the code form. Its flight code loops between AN2108 and AN2208, one for each wedding day. Opening the invitation shows the boarding pass with an optional **Board with music** switch. Tapping the pass sweeps a scanner beam, tears off the stub and opens the full invitation:

1. Ceremonial ticket and stamp/chop.
2. The flight from the airport through take-off and the cabin window to the clouds, a golden-hour sky and the monogram.
3. A wax-sealed envelope.
4. The formal Islamic invitation.
5. The story, with postcards.
6. The departures-board itinerary.
7. The venue, with its route map.
8. RSVP.
9. The arrival footer.

ScrollTrigger drives the cinematic sequence, which spans `600svh` on phones and `700svh` at larger widths. While a first-time guest enters their code, `src/preload.ts` hard-loads the journey's code and screen-sized artwork, decodes it on the boarding screen and pre-compiles the cloud shader.

Remembered visits skip check-in and open directly at the itinerary. A confirmed RSVP name produces **Welcome back, {name}.** followed by **Thank you for being part of our journey.** Older nameless receipts and guests who have not replied receive a generic welcome. The inline **Replay our full invitation** action starts the cinematic journey directly. Back returns to the itinerary after replay and to the boarding pass on a first visit. Native section links and browser Back/Forward retain navigation history. The small Back/language controls and inline RSVP link remain, and there is no guest overview or Simple view control.

A **departures board** at the top of the itinerary counts down (days, hours, minutes, in Singapore time) to the guest's next event. On the day it reads **TODAY** with the boarding time, during the event **NOW BOARDING**, between two days **Next departure in**, and afterwards **LANDED** with a thank-you, so it never freezes at zero. The logic lives in `src/departure.ts`; the board is decorative split-flap text with a visually hidden sentence for screen readers.

A **boarding dock** (`BoardingDock.tsx`) sits in the thumb zone once the guest reaches the itinerary and hides while the RSVP form or footer is on screen. It offers **Itinerary**, **Directions** (a sheet with Google Maps, Waze and Copy address), **Check in** (scrolls to the RSVP; reads **Checked in** after a reply) and, only after an attending RSVP, **Calendar** for the attending days. Boarding passes and itinerary cards show the seat for each day: **21A** on 21 August (AN2108) and **22A** on 22 August (AN2208).

**Wedding-day mode** follows the guest's own events in Singapore time (`src/weddingDay.ts`):

- On an event day a paper **gate card** sits under the board: *See you at the gate* with the first programme item before the start, *We are celebrating now* with **Now** and **Next** items during the event, and *Thank you for celebrating with us* afterwards. Google Maps and Waze lead until the event ends.
- Today's itinerary card leads with a **TODAY** tab; finished days move below it, dimmed, marked **LANDED**.
- The dock's gold action changes from **Check in** to **Directions** on the day, then to **Photos** after the last event.
- A guest opening the invitation for the first time on the day gets **Skip to today’s details** under the boarding pass (fast-track to the itinerary; Back returns to the pass).
- After the last event the board reads **LANDED** and a thank-you card remains.

**Share your photos** links (gate card from the start of the event, dock, thank-you card) appear only when `VITE_GALLERY_URL` is set to an HTTPS address. GitHub Pages deployments use https://gallery.aleemxnurul.love/ unless the repository variable `VITE_GALLERY_URL` overrides it; local builds read it from `.env`.

**Family contacts.** After unlock, Getting here shows *Questions? Message the family* with WhatsApp and Call buttons for the guest's hosting family only: the Wahab family for 21 August, the Jamal family for 22 August, both for two-day guests. WhatsApp opens with a greeting in the guest's language naming that family's day. On the wedding day the gate card adds *Lost? Message the family* for that day's hosts.

The contacts come from the build setting `VITE_FAMILY_CONTACTS` and **must never be committed** (this repository is public). Set it as the GitHub repository variable `VITE_FAMILY_CONTACTS`, as one line of JSON with up to three people per day; `role` is optional and local 8-digit Singapore numbers get +65:

```json
{"day21":[{"name":"…","role":{"en":"Bride's father","ms":"Bapa pengantin perempuan"},"phone":"+65 …"}],"day22":[{"name":"…","phone":"+65 …"}]}
```

Numbers are shown only after a guest unlocks the invitation, but like everything on a static site they are present in the deployed files. Without the variable the card is hidden.

To preview any moment locally, the development and e2e/demo builds accept `?now=` with an explicit time zone, e.g. `?now=2027-08-22T05:00:00Z` (1:00 pm in Singapore). Production builds ignore it.

The practical experience loads separately from check-in, and Journey plus its cloud renderer load only when the flight is opened. A journey failure leaves the wedding details and RSVP available. The broader loading/error fallback retains scoped dates, times, venue, directions and calendars. Older browsers retain secure UUID and media-query listener fallbacks.

The itinerary derives one card per eligible event, preserving programme and venue. Cards have no calendar/directions buttons: directions are in the venue section (Google Maps, Waze and Copy address) and the dock, and calendars follow successful attending RSVPs, both in the confirmation and in the dock. `presentInvitationEvent` clones presentation labels without changing the shared event catalogue. A one-day reception reads **Wedding Reception** / **Resepsi Perkahwinan**; a one-day invitation including Nikah reads **Nikah & Wedding Reception** / **Nikah & Resepsi Perkahwinan**. Both-day invitations retain their specific Bride/Groom headings. The same labels flow through tickets, programme reception entries, RSVP, confirmations and calendars. Programme arrival and Nikah times remain distinct.

## RSVP continuity and device privacy

A matching server receipt replaces the form with an attending, declining or mixed confirmation. Only attending events receive confirmation calendar links. The browser then removes the personal draft and saves a version-2 receipt: response ID, confirmation time, event attendance, party sizes and the trimmed name from the successfully confirmed response. The optional message and credential are excluded. Version-1 receipts remain readable without a name; an invalid optional name is discarded while retaining valid confirmation. Reopening displays **RSVP received on this device**, without moving focus away from the itinerary. The name is also used as the boarding-pass passenger and in a personal formal-invitation salutation on replay, in both languages. Shared invitation codes do not identify a household; a saved receipt may belong to another person who used the browser.

Unfinished drafts retain the answers needed to resume. An uncertain submission locks those answers and preserves its response ID and original language for an unchanged retry. A later failed retry does not erase that uncertainty. Conflicting answers never prompt a fresh resubmission: guests are directed to reply to the original invitation message for corrections. Closed, preview and unavailable responses have distinct guidance. Leaving the form aborts its transport and ignores late receipts. The Google bridge and backend validation protocol are unchanged.

After confirmation, **Another guest using this device** requires an explicit second action before replacing the local receipt with a fresh form for a different guest, immediately clearing the earlier personal greeting. It does not amend or cancel the earlier server response. If browser storage fails, a bounded in-memory fallback preserves drafts, uncertain retry identity and verified receipts through keepsake navigation during the current visit. It is lost on document reload/close; the form and confirmation explain that future persistence is unavailable. **Forget this device** clears this fallback too.

Calendar links open regular same-origin `.ics` resources without forcing a download or popup. The shared Vite plugin generates and serves twelve files under `calendar/`: the original reception-only 21 August, full 21 August, and 22 August files in English and Malay, plus six `-single-day-` variants with generic reception titles. All original URLs remain available. Variants preserve calendar UIDs, dates, times, time zone and separate Nikah events. The pure event catalogue in `src/invitationEvents.ts` supplies both invitation and calendar data. File URLs respect the deployment base path and return `text/calendar`. Verify the final native save flow on a physical iPhone in Safari and when arriving from a messaging app; Chromium emulation cannot confirm the Calendar handoff.

Use **Use a different invitation** below the boarding pass or in the footer to forget access and return to check-in while preserving drafts and receipts. In the footer's device settings, **Forget this device** removes this application's access, drafts and receipts from local/session storage while preserving language and unrelated data. Neither action cancels a server response. To reset only access during development:

```js
localStorage.removeItem('our-flight:access');
sessionStorage.removeItem('our-flight:access'); // pre-release access, if present
location.reload();
```

Storage belongs to the exact browser origin. The custom domain, an old `github.io` URL, localhost and messaging-app browsers can retain separate state. Clearing browser site data also removes remembered access, drafts and receipts.

## Automatic media fallbacks

Detected data saver (`navigator.connection.saveData`) and `slow-2g`/`2g` automatically use a static invitation without cinematic media. Reduced motion and missing IntersectionObserver also receive a static journey with the original ceremonial ticket. No manual display mode is required. Remembered itinerary visits never mount either journey variant or load its module/artwork.

The optional cinema retains responsive AVIF/WebP scenes, a transparent aircraft and procedural WebGL clouds. Airport/runway/aircraft load when the journey becomes visible; cabin/sky and the renderer follow as needed. Rendering stops offscreen and while the page is hidden, with capped resolution and a static sky fallback for unavailable/lost WebGL. Failed artwork leaves readable text and working navigation. The journey uses no video, cloud texture download or 3D library.

Check-in on phones can add a 267 KB looping cinemagraph of the airport photograph, with twinkling lights and shimmering reflections. The still photo remains the poster and the LCP image. The video is requested only after the page has loaded, and only in portrait on a 4G-class connection without data saver or reduced motion. If autoplay is refused, it removes itself.

Music is opt-in: "Untamable Love" by Kurtz Martin (Uppbeat) streams only after the guest switches it on, and it is credited in the footer. See [public/audio/README.md](public/audio/README.md).

## Static-site security boundary

This is intentionally one public static application. It contains the eight code hashes and invitation rules, so a technically capable visitor can inspect them or test short codes offline. The codes provide convenient invitation separation, not server-side secrecy or household identity verification. Never commit raw codes, old invitation tokens, the old shared passcode, spreadsheet IDs, or Apps Script secrets.

The old Sites deployment is disconnected and remains private only as a rollback copy.

## Local development

Use Node.js 22.13 or later; Node 24 is used by the deployment workflow.

1. Copy `.env.example` to the ignored `.env.local` file.
2. Add all eight SHA-256 hashes of the normalized class codes as `VITE_INVITE_CODE_HASH_*` and `VITE_INVITE_CODE_HASH_BRIDE_*`. Every hash is required, must be 64 hexadecimal characters, and must be unique across both sides.
3. Leave `VITE_LEGACY_INVITES_ENABLED=false` unless testing an old link. When it is `true`, also populate the five commented legacy hashes.
4. Keep `VITE_RSVP_STATUS=preview` and leave `VITE_APPS_SCRIPT_URL` blank until Google setup is complete.
5. Keep raw release values only in `.private/invite-access.txt`; `.private/` is ignored by Git. Use distinct `Groom ... code` and `Bride ... code` labels so the artifact scanner can protect all eight values.
6. Run:

   ```sh
   npm ci
   npm run dev
   ```

7. Open `http://localhost:5173/` and enter a class code.

To hash a code, first canonicalize it exactly as the application does, then calculate SHA-256. This example deliberately uses a placeholder rather than a real invitation code:

```sh
npm run hash:code -- "YOUR-CLASS-CODE"
```

Hash old opaque tokens and the old shared passcode without class-code normalization.

The original monogram master is `public/monogram-a-and-n.png`; do not optimise or overwrite it. The application uses a lossless WebP display derivative; the display PNG, favicon and social-preview derivatives remain alongside the master. See the [artwork rebuild instructions](artwork/flight/README.md).

Instrument Serif is self-hosted for display typography, IBM Plex Mono 500 for flight data and labels, system sans-serif remains the body font, and the existing self-hosted Amiri font handles Arabic. Generated scene masters, source prompts and instructions for rebuilding the responsive delivery assets and social preview are documented in [`artwork/flight/README.md`](artwork/flight/README.md). Delivery artwork lives in `public/flight/`; measured cabin-window geometry lives beside its source metadata in `src/sceneAssets.ts`.

## Editing the displayed programme

Edit the three clearly labelled bilingual lists in [`src/programme.ts`](src/programme.ts):

- `day21BrideReception` for bride-side Economy and Premium Economy.
- `day21NikahAndReception` for full 21 August invitations.
- `day22GroomReception` for 22 August invitations.

Each list may have its activity names, timestamps and number of entries edited independently. Keep guest arrival first, and Nikah second in the full 21 August list. Preserve `kind: 'reception'` on the reception entry so invitation-aware labels remain consistent. Redeploy GitHub Pages after a programme edit. Boarding-pass and calendar start/end times stay protected in `src/invitationEvents.ts` and are intentionally not derived from these display lists. Review both files when the event schedule changes.

## GitHub Pages configuration

In **Settings → Pages**, select **GitHub Actions** as the source.

The production custom domain is `rsvp.aleemxnurul.love`. Configure that domain and HTTPS in GitHub Pages settings and maintain its DNS mapping to Pages. The repository does not currently use a checked-in `public/CNAME`; the Pages custom-domain setting owns that association. The invitation is served at the domain root, not under `/our_flight/`.

Add these Actions secrets:

- `INVITE_CODE_HASH_ECONOMY`
- `INVITE_CODE_HASH_PREMIUM`
- `INVITE_CODE_HASH_BUSINESS`
- `INVITE_CODE_HASH_FIRST`
- `INVITE_CODE_HASH_BRIDE_ECONOMY`
- `INVITE_CODE_HASH_BRIDE_PREMIUM`
- `INVITE_CODE_HASH_BRIDE_BUSINESS`
- `INVITE_CODE_HASH_BRIDE_FIRST`

The first four names retain the existing groom-side hashes. Add the four bride-side hashes rather than replacing the groom-side values. The build fails when any of the eight is missing, malformed or duplicated.

Add these repository variables:

- `RSVP_STATUS`: begin with `preview`
- `APPS_SCRIPT_URL`: blank in preview, then the canonical `/exec` URL
- `LEGACY_INVITES_ENABLED`: set `true` for the transition release; code defaults to `false`
- `VITE_BASE_PATH`: workflow default `/`, controlling built asset paths for the custom-domain root
- `VITE_PUBLIC_SITE_URL`: workflow default `https://rsvp.aleemxnurul.love/`, controlling the canonical and social-preview URLs

While `LEGACY_INVITES_ENABLED=true`, retain these existing Actions secrets:

- `WEDDING_PASSCODE_HASH`
- `INVITE_TOKEN_HASH_ECONOMY`
- `INVITE_TOKEN_HASH_PREMIUM`
- `INVITE_TOKEN_HASH_BUSINESS`
- `INVITE_TOKEN_HASH_FIRST`

Push to `main` or run **Deploy GitHub Pages** manually. The workflow installs with Node 24, lints, tests, builds, scans the artifact, and deploys `dist/`. Its explicit base-path and public-URL defaults select the custom domain. Without these overrides, a GitHub Actions build falls back to the repository-derived `/our_flight/` base and `github.io` URL; that fallback is not the production configuration. `VITE_BASE_PATH` must be an absolute URL path, and `VITE_PUBLIC_SITE_URL` must be an HTTPS URL without credentials, query or fragment.

The Apps Script `PARENT_ORIGIN` must be `https://rsvp.aleemxnurul.love` (origin only). Changing hosting origins requires updating that property and redeploying Apps Script as well as Pages. This controls the browser receipt bridge, not invitation scope validation.

## Google setup and transition rollout

Follow [`integrations/google-apps-script/README.md`](integrations/google-apps-script/README.md). Deploy the updated Apps Script before deploying Pages so bridge version 2 is available.

For the bride-side expansion:

1. Keep both RSVP statuses at `preview`.
2. Add the four bride-side code hashes to Apps Script Properties and GitHub Actions secrets. Keep the existing four groom-side hashes unchanged.
3. Deploy the updated Apps Script first, run `setupWorkbook()` to migrate Responses and rebuild the side-specific Summary blocks, and run its configuration check.
4. Set `LEGACY_INVITES_ENABLED=true` in both Apps Script Properties and GitHub repository variables only when old hash links must remain available; retain the old token hashes and shared-passcode hash while it is enabled.
5. Deploy Pages, then test all eight class codes, their exact event scopes and at least one old hash link when legacy mode is enabled.
6. Submit a bride-side and groom-side RSVP, retry each response ID, and confirm that the side column and Groom, Bride and combined Summary totals are correct.
7. Change RSVP from `preview` to `open` only after every write and idempotent retry is confirmed.

To retire old links, set `LEGACY_INVITES_ENABLED=false` in both places, redeploy Apps Script and Pages, verify stale legacy sessions are rejected, and then delete the old token-hash properties/secrets and `WEDDING_PASSCODE_HASH`.

GitHub Pages cannot hide the Apps Script `/exec` URL. Apps Script therefore derives class and allowed event IDs from the submitted credential, validates every field, escapes spreadsheet formula prefixes, and handles response IDs idempotently. The browser shows success only after a matching version-2 receipt arrives from a Google response origin.

## Commands

- `npm run dev` — local Vite server
- `npm run dev:demo` — isolated preview at http://127.0.0.1:4175/; use E2EGROOM03, with RSVP sending disabled
- `npm run lint` — static analysis
- `npm test` — unit and contract tests
- `npm run build` — TypeScript and production build
- `npm run hash:code -- "YOUR-CLASS-CODE"` — normalize and hash a class code
- `npm run check:artifact` — secret, branding and performance-budget checks on `dist/`
- `npm run preview` — serve the production artifact locally
- `npm run test:e2e` — Playwright browser suite
- `npm run test:e2e:mobile` — all four supported phone projects
- `npm run test:e2e:update` — update reviewed screenshot baselines

## Mobile browser validation

Install browser binaries once after dependencies, then run the suite:

```sh
npm ci
npx playwright install chromium webkit
npm run test:e2e:mobile
npx playwright test --project=design-chromium --project=webkit-iphone
```

On Linux CI, use `npx playwright install --with-deps chromium webkit` to install browser system dependencies too. Playwright starts its own isolated Vite server with test-only invitation hashes and mocked Google receipts; it does not require real codes or a live Apps Script deployment. Never replace these fixtures with production credentials.

Chromium phone projects cover 375 × 667, 390 × 844, 412 × 915 and 430 × 932. They exercise first boarding passes, remembered itinerary visits, direct replay, event scope, reduced motion, automatic low data, RSVP and restored named/legacy confirmation. Layout checks include document overflow, text clipping/collisions inside cards, touch targets, Malay copy and increased text size. Unit tests additionally cover receipt validation, safe retries, blocked storage, device clearing, name isolation and calendar identity across presentation variants.

The `design-chromium` and `webkit-iphone` projects run the redesign suite in Chromium and WebKit. They cover check-in and wedding-content layouts at 360, 390, 412, 430, 768 and 1440px; capture each cinematic phase, reverse scrolling and landscape orientation; verify all invitation profiles and artwork-failure navigation; check keyboard-focused forms and RSVP receipts; and run automated accessibility checks. `npm run test:e2e` runs the phone and design projects together.

The checked-in screenshots were captured on Windows with the installed Playwright Chromium version. Baseline filenames include the OS because system fonts can differ. On another OS, run `npm run test:e2e:update`, review the generated images, then run the regular suite; commit reviewed baselines for that platform if it becomes a maintained runner. Existing baselines should only be updated after reviewing the visual changes. Playwright WebKit provides engine coverage but does not reproduce physical iPhone Safari, notches, native keyboards or all OS text-size settings, so retain a physical iOS/Android release smoke check.

Run `npm run lint`, `npm test`, `npm run build` and `npm run check:artifact` as well. Unit tests use jsdom browser storage, including on Node 25+ where the native Node storage API otherwise shadows it.

The [23 September validation report](REVAMP_VALIDATION.md) and [22 September launch audit](LAUNCH_AUDIT.md) are historical snapshots; their counts and measurements do not verify the current implementation. Run the commands above for current results. Physical iPhone/Android, messaging-app browsers, native calendar handoff, live Apps Script and deployed-network checks remain separate release checks.
