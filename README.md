# Aleem & Nurulain · Our Flight

A mobile-first English/Malay wedding invitation and RSVP website with four private cabin links: Economy, Premium Economy, Business, and First Class.

## Invitation matrix

- Economy and Premium Economy: Walimatul Urus on Sunday, 22 August 2027, 12:00–16:00.
- Business and First Class: Nikah and Bride's Reception on Saturday, 21 August 2027, 10:00–16:00, plus the 22 August Walimatul Urus.
- Every event is at Chengal Ballroom, Crowne Plaza Changi Airport, 75 Airport Boulevard, Singapore 819664.

Cabin scope is resolved only from a server-held hash of the opaque URL token. A signed, secure session cookie is issued after the shared passcode succeeds. One-day guests cannot request the 21 August invitation, calendar, or RSVP fields.

## Local development

This Sites project requires Node.js 22.13 or later.

```sh
npm install
npm run dev
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` and provide only hashes/secrets there. Never commit raw invitation tokens, the passcode, the session secret, or the Apps Script endpoint.

The initial page is intentionally lightweight: the passcode gate and journey use HTML/CSS, system fonts, and no initial atmospheric bitmap. There is no autoplay audio, analytics, advertising, email, or phone-number collection.

## RSVP delivery

The private Google workbook has `Responses` and `Summary` tabs. Its bound Apps Script accepts server-to-server requests, revalidates the invitation matrix, escapes spreadsheet-formula prefixes, and upserts by response ID so network retries do not duplicate rows.

Follow [integrations/google-apps-script/README.md](integrations/google-apps-script/README.md) for the one-time Google authorization and web-app deployment. Production must use `RSVP_DEMO_MODE=false`.

## Brand selection

The unlinked `/brand` route compares the transparent `A & A` and `A & N` marks on light and dark ticket mockups. Once selected, replace the temporary typographic `A & N` mark consistently before the final public release.
