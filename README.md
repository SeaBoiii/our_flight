# Aleem & Nurulain — Our Flight

A mobile-first Vite/React wedding invitation published as one static GitHub Pages site. Every guest starts at the same URL:

`https://seaboiii.github.io/our_flight/`

The A&N monogram, boarding-pass designs, ticket scan, cabin/window/cloud journey, bilingual invitation, itinerary, calendar actions and RSVP are shared across all invitations. The class-specific invitation code determines what the guest receives:

| Cabin class | Invitation scope |
| --- | --- |
| Economy | 22 August 2027 |
| Premium Economy | 22 August 2027 |
| Business | Separate 21 and 22 August boarding passes |
| First Class | Separate 21 and 22 August boarding passes |

There is no class selector. Codes are normalized with Unicode NFKC, trimmed, uppercased, and stripped of spaces and hyphens before hashing. A valid session lasts 30 minutes in `sessionStorage`. RSVP drafts use only the credential fingerprint in their local-storage key.

## Static-site security boundary

This is intentionally one public static application. It contains the four code hashes and invitation rules, so a technically capable visitor can inspect them or test short codes offline. The codes provide convenient invitation separation, not server-side secrecy or household identity verification. Never commit raw codes, old invitation tokens, the old shared passcode, spreadsheet IDs, or Apps Script secrets.

The old Sites deployment is disconnected and remains private only as a rollback copy.

## Local development

Use Node.js 22.13 or later.

1. Copy `.env.example` to the ignored `.env.local` file.
2. Add the four SHA-256 hashes of the normalized class codes as `VITE_INVITE_CODE_HASH_*`.
3. Leave `VITE_LEGACY_INVITES_ENABLED=false` unless testing an old link. When it is `true`, also populate the five commented legacy hashes.
4. Keep `VITE_RSVP_STATUS=preview` and leave `VITE_APPS_SCRIPT_URL` blank until Google setup is complete.
5. Keep raw release values only in `.private/invite-access.txt`; `.private/` is ignored by Git.
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

Edit [`src/programme.ts`](src/programme.ts) to change the guest-facing itinerary activities and times. These entries are intentionally separate from boarding-pass and calendar times in `src/invitations.ts`.

## GitHub Pages configuration

In **Settings → Pages**, select **GitHub Actions** as the source.

Add these Actions secrets:

- `INVITE_CODE_HASH_ECONOMY`
- `INVITE_CODE_HASH_PREMIUM`
- `INVITE_CODE_HASH_BUSINESS`
- `INVITE_CODE_HASH_FIRST`

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

For the transition:

1. Keep both RSVP statuses at `preview`.
2. Add all four new code hashes to Apps Script and GitHub Actions.
3. Set `LEGACY_INVITES_ENABLED=true` in both Apps Script Properties and GitHub repository variables; retain the old token hashes and shared-passcode hash.
4. Deploy a new Apps Script version, then deploy Pages.
5. Test all four new class codes and at least one old hash link.
6. Open both RSVP statuses only after a confirmed write and idempotent retry.

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
