# Aleem & Nurulain — Our Flight

A mobile-first Vite/React wedding invitation published as one static GitHub Pages site. Every guest starts at the same URL:

`https://rsvp.aleemxnurul.love/`

The A&N monogram, boarding-pass designs, ticket scan, Midnight to Daylight flight journey, bilingual invitation, itinerary, calendar actions and RSVP are shared across all invitations. The invitation side and cabin class derived from the entered code determine what the guest receives:

| Invitation side | Cabin class | Invitation scope |
| --- | --- | --- |
| Groom | Economy | 22 August Groom's Reception |
| Groom | Premium Economy | 22 August Groom's Reception |
| Groom | Business | Full 21 August programme and 22 August Groom's Reception |
| Groom | First Class | Full 21 August programme and 22 August Groom's Reception |
| Bride | Economy | 21 August Bride's Reception only |
| Bride | Premium Economy | 21 August Bride's Reception only |
| Bride | Business | 21 August Nikah and Bride's Reception |
| Bride | First Class | Full 21 August programme and 22 August Groom's Reception |

There is no side or class selector. Codes are normalized with Unicode NFKC, trimmed, uppercased, and stripped of spaces and hyphens before hashing. A version-4 record in `localStorage` remembers the invitation on that browser/device without an expiry. Every reload verifies its credential against the current configured hashes and checks the derived side, class and fingerprint before restoring access. Invalid records, changed access configuration, and disabled legacy credentials return to check-in. Browsers that block storage can still use the current visit.

This release discards old `sessionStorage` access records; existing guests check in once to begin persistent access. RSVP drafts remain in their separate fingerprint-based local-storage keys and are preserved when access is upgraded or forgotten.

## Guest journey and remembered invitations

The first manual check-in shows ivory boarding passes with navy class bands, gold accents and a scan interaction. The Midnight to Daylight design moves from a blue-hour airport into warm ivory wedding content. Scanning begins the cinematic journey, followed by the formal invitation, Our Story, departures-board-inspired itinerary, visible venue/address/directions, expandable transport guidance, RSVP and footer. The former Flight Dashboard has been retired from the guest experience; its implementation remains available in Git history.

A prominent tap instruction sits above the tickets. After scanning, a bilingual scroll prompt introduces five phases: the ceremonial ticket lifts away (0–18%), an aircraft takes off over the runway (18–40%), a premium cabin appears (40–56%), the camera advances through its photographed window (56–82%), and daylight clouds open around the A&N monogram (82–100%). Native scrolling controls the sequence in both directions, within a sticky stage spanning `600svh` on phones and `700svh` from tablet width upward. The welcome prompt disappears as the journey begins and returns when guests scroll back to the top.

Only an invitation restored from device storage offers the **Fast Track to Your Itinerary** button above the tickets, so returning guests can reach details without scrolling through both passes. Fast Track never mounts Journey or requests its cinematic artwork and focuses the itinerary heading. The formal invitation and Our Story stay available above the itinerary. Browser Back returns to boarding; Forward preserves the chosen entry mode. Reload always restores the boarding pass, allowing the guest to choose again.

The fixed **Your itinerary** and **RSVP** shortcuts are temporarily hidden so guests scroll through the journey before reaching the wedding details. The RSVP link after the itinerary still focuses the form heading and participates in browser history. **Back to boarding pass** and the language control remain at the top; boarding-page Fast Track remains exclusive to remembered invitations.

The invitation experience is loaded separately from check-in. While it loads, guests can read their event dates, times and venue, open directions or calendar links, and return to their tickets. An error boundary preserves the same practical information if the experience fails to load or render, with an explicit reload action. Browser storage failures leave the current visit usable. Older Web Crypto implementations use secure random bytes when `randomUUID` is unavailable, and reduced-motion subscriptions support the older media-query listener API.

The itinerary derives one card per `invitation.events` entry, with the correct flight, date, time, class, programme and venue, plus calendar and Maps links. Its RSVP shortcut takes guests directly to the attendance form. RSVP success and confirmed duplicate receipts replace the form with a bilingual flight confirmation: attending, warmly declining, or mixed attendance. Confirmation calendar links are offered only for attending events. The receipt bridge and server validation remain unchanged.

Calendar links open regular same-origin `.ics` resources without forcing a download or popup. The shared Vite plugin generates and serves six files under `calendar/`: reception-only 21 August, full 21 August, and 22 August, each in English and Malay. The pure event catalogue in `src/invitationEvents.ts` supplies both invitation and calendar data. File URLs respect the deployment base path and return `text/calendar`. Verify the final native save flow on a physical iPhone in Safari and when arriving from a messaging app; Chromium emulation cannot confirm the Calendar handoff.

Use **Use a different invitation** below the boarding pass or in the invitation footer to forget access and return to check-in. This preserves RSVP drafts and language preference. To reset only access during development, run the following in the browser console and reload:

```js
localStorage.removeItem('our-flight:access');
sessionStorage.removeItem('our-flight:access'); // pre-release access, if present
location.reload();
```

Storage belongs to the exact browser origin. The custom domain, an old `github.io` URL, and localhost each remember invitations separately. Clearing browser site data also clears remembered access and drafts.

Reduced motion, data saver (`navigator.connection.saveData`), `slow-2g`/`2g` connections and browsers without IntersectionObserver receive a compact static welcome and ceremonial ticket without requesting cinematic images. The reusable network hook subscribes to supported connection changes; browsers without the Network Information API use the normal scroll journey. Fast Track omits both journey variants.

The cinematic sequence combines responsive AVIF/WebP backgrounds, a transparent WebP aircraft and a procedural WebGL cloud volume. Airport, runway and aircraft artwork mount when the journey becomes visible; cabin/sky load progressively, and the 3D renderer initializes only as guests reach the cabin. The camera's perspective follows the viewport aspect ratio, with capped drawing resolution on phones and desktop. One animation-frame controller follows native scroll progress and suspends work offscreen or when the page is hidden. The clouds need no downloaded texture or 3D library. Unavailable or lost WebGL reveals the sky artwork; failed artwork leaves gradients while text and navigation remain usable. There is no cloud video or audio.

Tapping a boarding pass keeps the scan effect. The circular Singapore/A&N chop lands on the ceremonial ticket during the opening scroll, settles, then the ticket lifts away into the flight. This motion follows scroll progress in both directions; the compact reduced-motion composition omits the chop.

RSVP drafts are validated before restoration. Storage errors are disclosed without blocking the current visit; requests are cancelled when the form is left, preserving retry identity. The original submission language is retained across retries because it forms part of the server's duplicate-detection digest.

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

The original monogram master is `public/monogram-a-and-n.png`; do not optimise or overwrite it. Display, favicon and social-preview derivatives live beside it.

Instrument Serif is self-hosted for display typography, system sans-serif remains the body font, and the existing self-hosted Amiri font handles Arabic. Generated scene masters, source prompts and instructions for rebuilding the responsive delivery assets and social preview are documented in [`artwork/flight/README.md`](artwork/flight/README.md). Delivery artwork lives in `public/flight/`; measured cabin-window geometry lives beside its source metadata in `src/sceneAssets.ts`.

## Editing the displayed programme

Edit the three clearly labelled bilingual lists in [`src/programme.ts`](src/programme.ts):

- `day21BrideReception` for bride-side Economy and Premium Economy.
- `day21NikahAndReception` for full 21 August invitations.
- `day22GroomReception` for 22 August invitations.

Each list may have its activity names, timestamps and number of entries edited independently. Redeploy GitHub Pages after a programme edit. Boarding-pass and calendar start/end times stay protected in `src/invitationEvents.ts` and are intentionally not derived from these display lists.

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

Chromium phone projects cover 375 × 667, 390 × 844, 412 × 915 and 430 × 932. They exercise check-in, first/reopened boarding passes, returning-only Fast Track, itinerary focus and event scope, full and reduced-motion journeys, compact low-data invitations, itinerary, RSVP and confirmation. Layout checks include document overflow, text clipping/collisions inside cards, touch targets, Malay copy and increased text size.

The `design-chromium` and `webkit-iphone` projects run the redesign suite in Chromium and WebKit. They cover check-in and wedding-content layouts at 360, 390, 412, 430, 768 and 1440px; capture each cinematic phase, reverse scrolling and landscape orientation; verify all invitation profiles and artwork-failure navigation; check keyboard-focused forms and RSVP receipts; and run automated accessibility checks. `npm run test:e2e` runs the phone and design projects together.

The checked-in screenshots were captured on Windows with the installed Playwright Chromium version. Baseline filenames include the OS because system fonts can differ. On another OS, run `npm run test:e2e:update`, review the generated images, then run the regular suite; commit reviewed baselines for that platform if it becomes a maintained runner. Existing baselines should only be updated after reviewing the visual changes. Playwright WebKit provides engine coverage but does not reproduce physical iPhone Safari, notches, native keyboards or all OS text-size settings, so retain a physical iOS/Android release smoke check.

Run `npm run lint`, `npm test`, `npm run build` and `npm run check:artifact` as well. Unit tests use jsdom browser storage, including on Node 25+ where the native Node storage API otherwise shadows it.

The [Midnight to Daylight validation report](REVAMP_VALIDATION.md) records current redesign verification and remaining checks. The earlier [launch-readiness audit](LAUNCH_AUDIT.md) documents prior fixes and release-environment, live RSVP and physical-phone checks. The launch browser tests additionally exercise blocked chunks, older APIs, direct section navigation and 360px Malay text at 200%.
