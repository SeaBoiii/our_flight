# Aleem & Nurulain — Our Flight

A single mobile-first Vite/React wedding invitation for GitHub Pages. It restores the original transparent teal-and-gold A&N artwork and first boarding-pass design, while retaining the cabin-to-window-to-cloud journey.

The application has four invitation classes:

| Class | Invitation shown after check-in |
| --- | --- |
| Economy | 22 August 2027 |
| Premium Economy | 22 August 2027 |
| Business | Separate 21 and 22 August boarding passes |
| First Class | Separate 21 and 22 August boarding passes |

There is no class switcher. Each guest uses a link shaped like `https://OWNER.github.io/our_flight/#/i/OPAQUE_TOKEN` and the shared passcode. Because the invitation token is in the URL fragment, it is not sent in the GitHub Pages request.

## Static-site security boundary

This is intentionally one public static application. The browser checks SHA-256 token and passcode hashes and keeps an unlocked session for 30 minutes. The raw distribution tokens and passcode must never be committed, but the compiled rules and their hashes can be inspected or guessed offline by a technically capable visitor. Use long random values and treat this as invitation convenience, not server-grade access control.

The previous Sites deployment is not used by this application. Keep its `sites` Git remote private and do not push this restored Pages project to that remote; it remains only an external rollback copy.

## Local development

Use Node.js 22.13 or later.

1. Copy `.env.example` to the ignored `.env.local` file.
2. Add the SHA-256 hex digest of the shared passcode and one different opaque token for each class. The legacy local names `WEDDING_PASSCODE_HASH` and `INVITE_TOKEN_HASH_*` are also accepted.
3. Keep `VITE_RSVP_STATUS=preview` and leave `VITE_APPS_SCRIPT_URL` blank until Google setup is complete.
4. Keep raw invitation details only in `.private/invite-access.txt`; `.private/` is ignored by Git.
5. Install and run the site:

   ```sh
   npm ci
   npm run dev
   ```

6. Open a complete local hash link, for example `http://localhost:5173/#/i/OPAQUE_TOKEN`.

The exact historical master is `public/monogram-a-and-n.png`. Do not optimise or overwrite it. Display, favicon and social-preview derivatives live beside it.

## Editing the displayed programme

Edit [`src/programme.ts`](src/programme.ts) to change the guest-facing itinerary activities and times. Replace each `--:--` with a confirmed display time and update both the English and Malay descriptions. These programme entries are intentionally separate from the boarding-pass and calendar schedule in `src/invitations.ts`, so changing a march-in or cake-cutting time cannot accidentally alter a guest's calendar file.

## GitHub Pages deployment

Create or select the GitHub repository first; this workspace does not currently have a GitHub remote or GitHub CLI. Then configure **Settings → Pages → Source: GitHub Actions** and add these Actions secrets:

- `WEDDING_PASSCODE_HASH`
- `INVITE_TOKEN_HASH_ECONOMY`
- `INVITE_TOKEN_HASH_PREMIUM`
- `INVITE_TOKEN_HASH_BUSINESS`
- `INVITE_TOKEN_HASH_FIRST`

Add these repository variables:

- `RSVP_STATUS`: start with `preview`
- `APPS_SCRIPT_URL`: leave blank in preview; later use the canonical `https://script.google.com/macros/s/.../exec` URL

Push to `main` or run **Deploy GitHub Pages** manually. The workflow installs with Node 22, runs lint and tests, builds, scans the artifact for accidental secrets and performance-budget regressions, then deploys `dist/`. Vite derives `/our_flight/` and the social URL from `GITHUB_REPOSITORY`; no path editing is required.

## Enabling RSVP after Google setup

RSVP is deliberately a complete but disabled preview until storage is authorised and tested. Follow [`integrations/google-apps-script/README.md`](integrations/google-apps-script/README.md) to set up the private workbook and public Apps Script receipt bridge.

Only after a real test submission is confirmed in the Sheet:

1. Set the Apps Script property `RSVP_STATUS` to `open`.
2. Set the GitHub repository variable `APPS_SCRIPT_URL` to the deployed `/exec` URL.
3. Set the repository variable `RSVP_STATUS` to `open`.
4. Re-run the Pages workflow and test one idempotent retry before sharing links.

GitHub Pages cannot hide the `/exec` URL. Apps Script therefore derives class and allowed event IDs from the submitted invitation token, validates every field, escapes spreadsheet formula prefixes and handles response IDs idempotently. The browser only shows success after a matching `postMessage` receipt arrives from the Google response frame; timeouts remain unconfirmed and retain the saved draft.

## Commands

- `npm run dev` — local Vite server
- `npm run lint` — static analysis
- `npm test` — unit and contract tests
- `npm run build` — TypeScript and production build
- `npm run check:artifact` — secret, branding and performance-budget checks on `dist/`
- `npm run preview` — serve the production artifact locally
