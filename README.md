# Aleem & Nurulain - Our Flight

This workspace contains two deliberately separate deployables:

- `frontend/` is a standalone Vite/React site for a separate public GitHub Pages repository.
- The workspace root is a Vinext/Sites API service. It owns invitation scope, credential hashes, signed access tokens, calendar files, and Google Sheets delivery.

GitHub Pages links use `#/i/<opaque-token>`, so the invitation token remains in the browser fragment and is not sent to GitHub. The frontend sends it only to `POST /api/v1/unlock` after the guest enters the shared passcode.

## Security model

The API derives cabin class and event scope from server-held token hashes. Successful check-in returns a 30-minute signed bearer token; no invitation cookie is used. The browser keeps that bearer token in `sessionStorage`, while unfinished RSVP values and the idempotency ID are kept locally under a hash-derived key.

The API accepts only the exact configured `FRONTEND_ORIGIN`, including preflight checks. The public package contains no class-token mapping, passcode material, signing secret, Apps Script endpoint, ingestion secret, or private two-day itinerary literals.

## Invitation matrix

- Economy and Premium Economy receive the Sunday, 22 August 2027 Walimatul Urus, 12:00-16:00.
- Business and First Class receive Saturday, 21 August 2027 (Nikah 10:00-12:00 and Bride's Reception 12:00-16:00) and the Sunday celebration.
- Every event is at Chengal Ballroom, Crowne Plaza Changi Airport, 75 Airport Boulevard, Singapore 819664.

## Backend development

The Sites service requires Node.js 22.13 or later.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Copy `.env.example` to `.env.local` and provide only hashes and secrets there. Keep `RSVP_STATUS=preview` until Google response storage has been authorized and verified. Never commit raw invitation tokens, the passcode, signing secret, or Apps Script endpoint.

Versioned routes:

- `POST /api/v1/unlock`
- `GET /api/v1/invitation`
- `POST /api/v1/rsvp`
- `GET /api/v1/calendar/:day`

The root page is intentionally only a generic, non-indexed API status screen.

## Frontend development and GitHub Pages

See [frontend/README.md](frontend/README.md). The Pages workflow uses Node 22, runs lint/tests/build, scans the output for restricted literals and budgets, then publishes the static artifact. Configure the repository variable `API_ORIGIN` with the final Sites API origin before the workflow can build.

## Google RSVP delivery

The private workbook has formatted `Responses` and `Summary` tabs. Its bound Apps Script revalidates invitation scope, escapes spreadsheet-formula prefixes, and upserts by response ID so a poor-network retry cannot create a duplicate row.

Follow [integrations/google-apps-script/README.md](integrations/google-apps-script/README.md) for the one-time authorization and web-app deployment. Only after the test response and retry have been verified should the backend setting change to `RSVP_STATUS=open`.
