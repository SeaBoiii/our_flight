# Private Google Sheet RSVP integration

The GitHub Pages app is static, so its Google Apps Script `/exec` URL and the invitation rules are necessarily present in the downloaded application. Apps Script remains the authority for writes: it hashes the supplied opaque invitation token, derives the cabin class and permitted days, validates every RSVP field, and writes only accepted records to the private spreadsheet.

The wedding passcode is **not** sent to Apps Script. It is only a lightweight check-in gate in the public client. Treat each high-entropy invitation token as a class-level write credential and distribute it privately.

## How the browser bridge works

GitHub Pages submits a native `application/x-www-form-urlencoded` form into a hidden, sandboxed iframe. The form has three fields:

- `bridgeVersion=1`
- `nonce=<UUID>`
- `payload=<JSON>`

The payload contract is:

```json
{
  "version": 1,
  "token": "opaque-invitation-token",
  "responseId": "UUID",
  "locale": "en",
  "inviteeName": "Honoured Guest",
  "message": "Optional, at most 500 characters",
  "responses": [
    { "eventId": "day22", "attendance": "attending", "partySize": 2 }
  ]
}
```

Apps Script returns an `HtmlOutput` page which calls `window.parent.postMessage` with a correlated receipt:

```json
{
  "type": "our-flight:rsvp-result",
  "version": 1,
  "nonce": "same UUID",
  "responseId": "same response UUID",
  "ok": true,
  "duplicate": false
}
```

Failures use `ok: false`, a stable `error` code, and optionally `fields`. The browser must accept a receipt only when the message origin is a Google script/content origin and `type`, `version`, `nonce`, and `responseId` all match. Because a sandbox without `allow-same-origin` gives the iframe an opaque `null` origin, the submission iframe must include `allow-forms allow-scripts allow-same-origin`. This is safe here because the loaded document is cross-origin and receives no same-origin access to the GitHub Pages parent.

An iframe load or a timed-out request is never proof of success. The site must keep the draft and response ID until it receives the matching successful receipt.

## One-time workbook setup

1. Create or open the private **Aleem & Nurulain — RSVP Responses** Google Sheet.
2. Choose **Extensions → Apps Script**.
3. Replace the editor contents with [`Code.gs`](./Code.gs). In **Project Settings**, enable the manifest and use [`appsscript.json`](./appsscript.json) if desired.
4. Run `setupWorkbook()` once and approve the spreadsheet permission. It formats `Responses` and `Summary`, sets `Asia/Singapore`, and records the spreadsheet ID in Script Properties.
5. In **Project Settings → Script properties**, add all properties in the table below.
6. Run `verifyConfiguration()`. It validates the setup without logging any hashes or raw tokens.
7. Choose **Deploy → New deployment → Web app**. Execute as **Me** and grant access to **Anyone**. Copy the canonical URL ending in `/exec` (not a `/dev` test URL).
8. For local builds, put that URL in `VITE_APPS_SCRIPT_URL`. In GitHub Actions, use the repository variable `APPS_SCRIPT_URL` (the workflow maps it into the build). Keep the corresponding status at `preview` while testing.

## Required Script Properties

| Property | Value |
| --- | --- |
| `RSVP_STATUS` | Start with `preview`; use `open` only for the release; use `closed` after RSVPs close. |
| `PARENT_ORIGIN` | Exact Pages origin, for example `https://ACCOUNT.github.io`. Use the origin only—no `/our_flight/` path and no trailing slash. |
| `INVITE_TOKEN_HASH_ECONOMY` | Lowercase SHA-256 hex of the Economy token. |
| `INVITE_TOKEN_HASH_PREMIUM` | Lowercase SHA-256 hex of the Premium Economy token. |
| `INVITE_TOKEN_HASH_BUSINESS` | Lowercase SHA-256 hex of the Business token. |
| `INVITE_TOKEN_HASH_FIRST` | Lowercase SHA-256 hex of the First Class token. |

`SPREADSHEET_ID` is written by `setupWorkbook()`. Do not add `INGEST_SECRET`, raw invitation tokens, the raw wedding passcode, or a spreadsheet URL to the source code.

The four invitation-token hashes must exactly match the four `VITE_INVITE_HASH_*` values used by the Pages build. All four must be distinct. Economy and Premium Economy tokens accept exactly `day22`; Business and First Class tokens accept exactly `day21` and `day22`.

## Preview, test, and release sequence

1. Leave both `RSVP_STATUS` values at `preview`: the Apps Script Property and the Pages repository variable. For a local build, the equivalent client variable is `VITE_RSVP_STATUS`. The full RSVP form remains visible but disabled.
2. Deploy the Apps Script web app and configure its `/exec` URL in the Pages build.
3. In a private test deployment, set Apps Script `RSVP_STATUS=open` and set the Pages repository variable `RSVP_STATUS=open` (or `VITE_RSVP_STATUS=open` locally).
4. Submit one Economy/Premium test and one Business/First test. Confirm the permitted days and cabin classes in `Responses` and the totals in `Summary`.
5. Retry each unchanged form with the same response ID. It must return `duplicate: true` and create no additional row.
6. Change a payload while reusing the same response ID. It must return `idempotency_conflict` and leave the original row untouched.
7. Test an invalid token, an Economy/Premium submission containing `day21`, a missing party size while attending, a party size supplied while declining, and a message over 500 characters. None may write a row.
8. Before public release, rotate any temporary raw tokens/passcode, rebuild Pages with the final hashes, set both statuses to `open`, and repeat one controlled end-to-end RSVP.

Changing a Script Property does not require exposing it in Git, but code changes require a new Apps Script deployment version. Keep the Sheet private and do not share its URL with guests.

## Validation and storage behavior

- The server derives cabin class and invitation scope from the token hash; client-supplied class/scope values are neither required nor trusted.
- A one-day token must submit exactly `day22`. A two-day token must submit `day21` and `day22` exactly once each.
- Name and attendance are required. Attending requires a positive safe whole-number party size; declining forbids one. There is no product-level guest maximum.
- The optional message is limited to 500 characters.
- User-entered name and message values beginning with `=`, `+`, `-`, or `@` are escaped before spreadsheet insertion.
- Server timestamps use the spreadsheet's Singapore timezone for display.
- Two hidden metadata columns store the invitation-token hash and canonical payload digest. The raw token is never written.
- An identical retry with the same response ID, token hash, and payload digest returns a duplicate receipt without another write. Reusing the response ID for changed content or another token returns `idempotency_conflict`.

## Security boundary

This is deliberately a static-site architecture. The Apps Script URL and client-side hashes are discoverable, and a sufficiently technical visitor can inspect the compiled invitation rules. High-entropy tokens, strict server validation, exact-scope derivation, idempotency, and a private workbook limit accidental or malformed submissions; they do not provide household identity verification or server-side secrecy.
