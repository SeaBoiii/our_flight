# Private Google Sheet RSVP integration

The GitHub Pages site submits RSVP data to a bound Google Apps Script web app. Apps Script is the write authority: it normalizes and hashes the supplied access credential, derives the cabin class and permitted event days, validates the response, and writes accepted records to the private workbook.

## Browser bridge contract

The current client posts a native `application/x-www-form-urlencoded` form into a hidden sandboxed iframe with:

- `bridgeVersion=2`
- `nonce=<UUID>`
- `payload=<JSON>`

The version-2 payload uses an access credential union:

```json
{
  "version": 2,
  "credential": { "kind": "class-code", "value": "SAMPLE88" },
  "responseId": "UUID",
  "locale": "en",
  "inviteeName": "Honoured Guest",
  "message": "Optional, at most 500 characters",
  "responses": [
    { "eventId": "day22", "attendance": "attending", "partySize": 2 }
  ]
}
```

During migration, version-2 requests may use `kind: "legacy-token"`. Existing version-1 browser tabs may still send their original `token` payload only when `LEGACY_INVITES_ENABLED=true`.

Apps Script responds through `window.top.postMessage` because HtmlService nests the receipt page in a Google wrapper frame:

```json
{
  "type": "our-flight:rsvp-result",
  "version": 2,
  "nonce": "same UUID",
  "responseId": "same response UUID",
  "ok": true,
  "duplicate": false
}
```

The response version matches the accepted request version. The browser accepts a receipt only from an HTTPS Google script/content origin when type, version, nonce, and response ID all match. A timeout or iframe load is never treated as success; the saved draft and response ID remain available for retry.

## One-time workbook setup

1. Create or open the private **Aleem & Nurulain — RSVP Responses** Google Sheet.
2. Choose **Extensions → Apps Script**.
3. Replace the editor contents with [`Code.gs`](./Code.gs). Enable the manifest and use [`appsscript.json`](./appsscript.json) if desired.
4. Run `setupWorkbook()` once and authorize it. This formats `Responses` and `Summary`, sets `Asia/Singapore`, and records `SPREADSHEET_ID`.
5. Add the Script Properties below.
6. Run `verifyConfiguration()`. It validates the setup without logging credential hashes or raw credentials.
7. Deploy as a **Web app**, execute as **Me**, with access for **Anyone**. Copy the canonical URL ending in `/exec`, not `/dev`.
8. Keep both RSVP statuses at `preview` until the transition tests pass.

## Required Script Properties

| Property | Value |
| --- | --- |
| `RSVP_STATUS` | `preview`, `open`, or `closed`; begin with `preview`. |
| `PARENT_ORIGIN` | `https://seaboiii.github.io` — origin only, without `/our_flight/` or a trailing slash. |
| `INVITE_CODE_HASH_ECONOMY` | Lowercase SHA-256 of the normalized Economy code. |
| `INVITE_CODE_HASH_PREMIUM` | Lowercase SHA-256 of the normalized Premium Economy code. |
| `INVITE_CODE_HASH_BUSINESS` | Lowercase SHA-256 of the normalized Business code. |
| `INVITE_CODE_HASH_FIRST` | Lowercase SHA-256 of the normalized First Class code. |
| `LEGACY_INVITES_ENABLED` | `true` for transition or `false` to reject old links; defaults to `false` when absent. |

When legacy mode is `true`, retain these additional properties:

- `INVITE_TOKEN_HASH_ECONOMY`
- `INVITE_TOKEN_HASH_PREMIUM`
- `INVITE_TOKEN_HASH_BUSINESS`
- `INVITE_TOKEN_HASH_FIRST`

`SPREADSHEET_ID` is written by `setupWorkbook()`. Do not put raw codes, tokens, the shared passcode, spreadsheet URLs, or unrelated secrets into source control.

Class codes are canonicalized with Unicode NFKC, trim, uppercase, and removal of spaces/hyphens before SHA-256. The four `INVITE_CODE_HASH_*` values must exactly match the GitHub Actions secrets and must be distinct. Economy and Premium accept exactly `day22`; Business and First accept exactly `day21` and `day22`.

## Preview, validation and release

1. Run `setupWorkbook()` once more after replacing the script; this updates the hidden metadata heading without moving existing rows.
2. Deploy this updated Apps Script code as a **new version** of the existing web-app deployment, preserving its `/exec` URL.
3. Set Apps Script and Pages `LEGACY_INVITES_ENABLED=true` for the transition.
4. Deploy Pages with all four new hashes and the legacy secrets.
5. Test all four new class codes and at least one old link while RSVP remains in preview.
6. Temporarily set both RSVP statuses to `open`. Submit a one-day response and a two-day response and confirm class, scope, rows, and Summary totals.
7. Retry the unchanged payload with the same response ID. It must return `duplicate: true` without adding a row.
8. Change the payload but reuse the response ID. It must return `idempotency_conflict` and preserve the original row.
9. Verify that a one-day credential cannot submit `day21`, attending requires a positive safe whole number, declining forbids a party size, and messages over 500 characters are rejected.
10. Reopen RSVP only after these tests pass.

For retirement, change `LEGACY_INVITES_ENABLED` to `false` in Apps Script and Pages, redeploy both, test an old link and stale old session, then delete the four old token-hash properties and five old GitHub Actions secrets.

## Storage and safety behavior

- Class and scope are derived from the credential hash; client-supplied class/scope values are ignored.
- Formula-leading name and message values are escaped before spreadsheet insertion.
- The hidden metadata heading is **Access credential hash** and remains in the same column as the previous token-hash metadata. Existing rows are not moved.
- Legacy requests retain the original version-1 canonical digest so retries can match rows written before the migration.
- The raw credential is never written to the Sheet.
- This static architecture limits accidental or malformed submissions but does not provide server-side secrecy or household identity verification.
