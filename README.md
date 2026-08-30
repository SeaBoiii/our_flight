# Aleem & Nurulain — Our Flight

A mobile-first Vite/React wedding invitation published as one static GitHub Pages site. Every guest starts at the same URL:

`https://seaboiii.github.io/our_flight/`

The A&N monogram, boarding-pass designs, ticket scan, cabin/window/cloud journey, bilingual invitation, itinerary, calendar actions and RSVP are shared across all invitations. The invitation side and cabin class derived from the entered code determine what the guest receives:

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

There is no side or class selector. Codes are normalized with Unicode NFKC, trimmed, uppercased, and stripped of spaces and hyphens before hashing. A valid version-3 session stores its side, class, credential fingerprint and 30-minute expiry in `sessionStorage`. Sessions from older application versions intentionally return to check-in after this release. RSVP drafts remain keyed only by the credential fingerprint and survive that session upgrade.

## Static-site security boundary

This is intentionally one public static application. It contains the eight code hashes and invitation rules, so a technically capable visitor can inspect them or test short codes offline. The codes provide convenient invitation separation, not server-side secrecy or household identity verification. Never commit raw codes, old invitation tokens, the old shared passcode, spreadsheet IDs, or Apps Script secrets.

The old Sites deployment is disconnected and remains private only as a rollback copy.

## Local development

Use Node.js 22.13 or later.

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

## Editing the displayed programme

Edit the three clearly labelled bilingual lists in [`src/programme.ts`](src/programme.ts):

- `day21BrideReception` for bride-side Economy and Premium Economy.
- `day21NikahAndReception` for full 21 August invitations.
- `day22GroomReception` for 22 August invitations.

Each list may have its activity names, timestamps and number of entries edited independently. Redeploy GitHub Pages after a programme edit. Boarding-pass and calendar start/end times stay protected in `src/invitations.ts` and are intentionally not derived from these display lists.

## GitHub Pages configuration

In **Settings → Pages**, select **GitHub Actions** as the source.

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

While `LEGACY_INVITES_ENABLED=true`, retain these existing Actions secrets:

- `WEDDING_PASSCODE_HASH`
- `INVITE_TOKEN_HASH_ECONOMY`
- `INVITE_TOKEN_HASH_PREMIUM`
- `INVITE_TOKEN_HASH_BUSINESS`
- `INVITE_TOKEN_HASH_FIRST`

Push to `main` or run **Deploy GitHub Pages** manually. The workflow installs with Node 22, lints, tests, builds, scans the artifact, and deploys `dist/`. Vite derives `/our_flight/` and the public social URL from `GITHUB_REPOSITORY`.

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
- `npm run lint` — static analysis
- `npm test` — unit and contract tests
- `npm run build` — TypeScript and production build
- `npm run hash:code -- "YOUR-CLASS-CODE"` — normalize and hash a class code
- `npm run check:artifact` — secret, branding and performance-budget checks on `dist/`
- `npm run preview` — serve the production artifact locally
