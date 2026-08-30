# Private Google Sheet RSVP integration

The GitHub Pages site submits RSVP data to a bound Google Apps Script web app. Apps Script is the write authority: it normalizes and hashes the supplied access credential, derives the invitation side, cabin class and permitted event days, validates the response, and writes accepted records to the private workbook.

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
4. Run `setupWorkbook()` once and authorize it. This formats `Responses` and `Summary`, sets `Asia/Singapore`, records `SPREADSHEET_ID`, migrates the side column, and rebuilds the Groom, Bride and combined Summary blocks.
5. Add the Script Properties below.
6. Run `verifyConfiguration()`. It validates the setup without logging credential hashes or raw credentials.
7. Deploy as a **Web app**, execute as **Me**, with access for **Anyone**. Copy the canonical URL ending in `/exec`, not `/dev`.
8. Keep both RSVP statuses at `preview` until the transition tests pass.

## Required Script Properties

| Property | Value |
| --- | --- |
| `RSVP_STATUS` | `preview`, `open`, or `closed`; begin with `preview`. |
| `PARENT_ORIGIN` | `https://seaboiii.github.io` — origin only, without `/our_flight/` or a trailing slash. |
| `INVITE_CODE_HASH_ECONOMY` | Lowercase SHA-256 of the normalized groom-side Economy code. |
| `INVITE_CODE_HASH_PREMIUM` | Lowercase SHA-256 of the normalized groom-side Premium Economy code. |
| `INVITE_CODE_HASH_BUSINESS` | Lowercase SHA-256 of the normalized groom-side Business code. |
| `INVITE_CODE_HASH_FIRST` | Lowercase SHA-256 of the normalized groom-side First Class code. |
| `INVITE_CODE_HASH_BRIDE_ECONOMY` | Lowercase SHA-256 of the normalized bride-side Economy code. |
| `INVITE_CODE_HASH_BRIDE_PREMIUM` | Lowercase SHA-256 of the normalized bride-side Premium Economy code. |
| `INVITE_CODE_HASH_BRIDE_BUSINESS` | Lowercase SHA-256 of the normalized bride-side Business code. |
| `INVITE_CODE_HASH_BRIDE_FIRST` | Lowercase SHA-256 of the normalized bride-side First Class code. |
| `LEGACY_INVITES_ENABLED` | `true` for transition or `false` to reject old links; defaults to `false` when absent. |

When legacy mode is `true`, retain these additional properties:

- `INVITE_TOKEN_HASH_ECONOMY`
- `INVITE_TOKEN_HASH_PREMIUM`
- `INVITE_TOKEN_HASH_BUSINESS`
- `INVITE_TOKEN_HASH_FIRST`

`SPREADSHEET_ID` is written by `setupWorkbook()`. Do not put raw codes, tokens, the shared passcode, spreadsheet URLs, or unrelated secrets into source control.

Class codes are canonicalized with Unicode NFKC, trim, uppercase, and removal of spaces/hyphens before SHA-256. All eight `INVITE_CODE_HASH_*` values must exactly match the GitHub Actions secrets and must be present, valid lowercase SHA-256 values, and globally distinct.

The server-derived invitation matrix is:

| Invitation side | Class | Accepted event IDs |
| --- | --- | --- |
| Groom | Economy / Premium Economy | Exactly `day22` |
| Groom | Business / First Class | Exactly `day21` and `day22` |
| Bride | Economy / Premium Economy | Exactly `day21`, reception-only scope |
| Bride | Business | Exactly `day21`, full Nikah-and-reception scope |
| Bride | First Class | Exactly `day21` and `day22` |

## Preview, validation and release

1. Run `setupWorkbook()` once more after replacing the script. It inserts the visible **Invitation side** column at M, moves the unchanged credential hash and payload digest to hidden N/O, backfills existing rows as `groom`, and rebuilds separate Groom and Bride Summary blocks plus combined totals. Columns A:L and existing response IDs remain unchanged.
2. Deploy this updated Apps Script code as a **new version** of the existing web-app deployment, preserving its `/exec` URL.
3. Run `verifyConfiguration()` and confirm it reports eight configured credentials without exposing their hashes.
4. Keep both RSVP statuses at `preview`. Set Apps Script and Pages `LEGACY_INVITES_ENABLED=true` only when old links must remain available.
5. Deploy Pages with the existing four groom hashes, the four bride hashes, and the legacy secrets when compatibility is enabled.
6. Test all eight class codes and their exact event scopes, plus at least one old link when legacy mode is enabled, while RSVP remains in preview.
7. Temporarily set both RSVP statuses to `open`. Submit one bride-side and one groom-side response, including one-day and two-day scopes, and confirm side, class, scope, rows, and Groom, Bride and combined Summary totals.
8. Retry the unchanged payload with the same response ID. It must return `duplicate: true` without adding a row.
9. Change the payload but reuse the response ID. It must return `idempotency_conflict` and preserve the original row.
10. Verify that each one-day credential is rejected for every unauthorized day, attending requires a positive safe whole number, declining forbids a party size, and messages over 500 characters are rejected.
11. Reopen RSVP only after these tests pass.

For retirement, change `LEGACY_INVITES_ENABLED` to `false` in Apps Script and Pages, redeploy both, test an old link and stale old session, then delete the four old token-hash properties and five old GitHub Actions secrets.

## Storage and safety behavior

- Invitation side, class and scope are derived from the credential hash; client-supplied side/class/scope values are ignored.
- Formula-leading name and message values are escaped before spreadsheet insertion.
- **Invitation side** is visible at column M. **Access credential hash** and **Payload digest** are hidden at N/O; existing A:L response data is not moved.
- Existing response rows are backfilled as groom-side submissions during `setupWorkbook()`; raw credentials are never needed for migration.
- Legacy requests retain the original version-1 canonical digest so retries can match rows written before the migration.
- The raw credential is never written to the Sheet.
- This static architecture limits accidental or malformed submissions but does not provide server-side secrecy or household identity verification.
