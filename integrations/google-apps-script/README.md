# Private Google Sheet RSVP ingestion

The website sends validated responses from its server to a bound Google Apps Script. Guests never receive the spreadsheet URL, Apps Script URL, wedding passcode, or ingestion secret.

## One-time setup

1. Open the private **Aleem & Nurulain — RSVP Responses** spreadsheet.
2. Choose **Extensions → Apps Script**.
3. Replace the editor contents with `Code.gs` from this folder. In **Project Settings**, enable the manifest and copy the values from `appsscript.json` if desired.
4. Run `setupWorkbook()` once and approve the requested spreadsheet permission. This formats the `Responses` and `Summary` tabs and sets the timezone to `Asia/Singapore`.
5. In **Project Settings → Script properties**, add `INGEST_SECRET` with a fresh high-entropy value. Use the same value as the website deployment secret `APPS_SCRIPT_SHARED_SECRET`; never paste it into source code.
6. Choose **Deploy → New deployment → Web app**. Execute as **Me** and allow access to **Anyone**. Copy the `/exec` URL.
7. Add that URL to the website deployment secret `APPS_SCRIPT_URL`, keep `RSVP_DEMO_MODE=false`, and redeploy.

The public web-app setting is safe only because every request must include the server-held ingestion secret. The script validates invitation scope again, escapes spreadsheet-formula prefixes, uses a lock, and updates an existing response row when the same response ID is retried.

## Quick verification

Submit one test RSVP from a private invitation link, confirm exactly one row appears in `Responses`, then retry from the same browser. The same row should update instead of creating a duplicate, and `Summary` should reflect the correct day and cabin totals.
