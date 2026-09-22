# Launch-readiness audit

Audit date: 22 September 2026. Reviewed the local application, generated production assets, isolated browser fixtures, Apps Script source, and read-only public-site responses. The existing flight identity and English/Malay invitation scopes are preserved. No deployment or live RSVP submission was performed.

## Findings and changes

No Critical issue was identified in the inspected scope. The following High issues were fixed:

| Issue | Change |
| --- | --- |
| A failed entry script left a blank page; a failed invitation chunk removed access to practical information. | Bilingual startup/no-JavaScript guidance and reload link; loading/error recovery retains scoped dates, times, venue, directions and calendars, with Back and Reload controls. |
| Malformed saved RSVP answers could crash the form. | Validate every saved answer before restoring the draft; invalid data starts a usable fresh form. |
| A late RSVP receipt after leaving the form could erase a newer saved draft. | Abort departed transports, remove their listeners/forms, and ignore late results while preserving the response ID for safe retries. |
| Missing newer browser APIs could prevent the invitation opening. | Secure UUID fallback using `crypto.getRandomValues`, legacy media-query listeners, native form-submit fallback, and a static journey when IntersectionObserver is unavailable. |

Low-risk Medium fixes:

- Put returning guests' Fast Track above the tickets. Add persistent itinerary/RSVP links, correct heading focus after native fragment navigation, and preserve Back/Forward behavior.
- Preserve the first submission's locale across retries and reloads, because locale participates in the backend's idempotency digest.
- Clear corrected validation errors, translate existing errors with the interface, accurately disclose unavailable browser storage, and keep cleared drafts deleted.
- Flush pending spreadsheet writes before releasing the Apps Script lock and issuing a success receipt. This follows the [Google Lock documentation](https://developers.google.com/apps-script/reference/lock/lock#releaselock).
- Increase RSVP label, radio-option, help-text and action readability. Fix itinerary/programme wrapping and invitation/RSVP heading clipping at enlarged text sizes. Reserve navigation clearance when controls wrap.
- Darken Premium Economy flight/date text that measured only 2.79:1 contrast, while retaining the orange accents and border effects. Include visible BM/EN abbreviations in language-button accessible names and remove an unsupported generic-element label.
- Defer cloud-video loading/playback until the clouds are visible; pause offscreen and immediately when the page is hidden. Preserve static posters for data-saving connections, reduced motion and failed media.

The earlier boarding/calendar plan remains implemented: prominent ticket guidance and three gentle pulses, the scroll prompt, Flight Dashboard retirement, six hosted `.ics` assets, base-path-aware native calendar links, stable UIDs and correctly scoped attending-only confirmation calendars.

## Verification

| Check | Result |
| --- | --- |
| ESLint | Passed. |
| Unit/integration suite | 172 tests passed across 17 files, including 16 Apps Script contract tests. |
| Playwright browser suite | 70 passed, 6 intentionally skipped duplicate viewport cases; final run used the reviewed baselines without updating them. |
| TypeScript + production validation build | Passed using public test hashes and RSVP preview mode. Actual release configuration remains unverified. |
| Artifact checks | Passed: 32 files, 492,347 estimated initial bytes, 73,293 gzip entry-JavaScript bytes. |
| Calendar HTTP checks | All six files passed GET/HEAD, content type and content checks at a production-preview root and development subpath. WebKit phone smoke passed native-link/download and scroll guidance. |
| axe-core accessibility | No confirmed A/AA violations in 25 gate/boarding/experience viewport-and-locale samples or 16 invitation-profile/language boarding samples. Gradient/overlay contrast required manual checking; Premium Economy's identified issue was fixed and rechecked at 8.79–9.24:1. |
| Resilience | No-JavaScript guidance, blocked video/poster, blocked invitation chunk, storage failure, older APIs and request cleanup verified with fixtures. |
| Dependency audit | `npm audit --json` reported zero known vulnerabilities, including development dependencies. |
| Lighthouse mobile, production-preview entrance | Three final runs: Performance 95/92/93, Accessibility 100/100/100, Best Practices 100/100/100. Median LCP 3.18 s, CLS 0, TBT 11 ms. SEO was not scored because this invitation intentionally discourages indexing. |

The navigation unit test explicitly models native fragment navigation because jsdom queues it differently from browsers; native behavior is separately covered by the passing browser suite. Lighthouse measured the entrance on a local validation build, not a live RSVP or a complete guest journey. Audit artifacts are under ignored `work/`; temporary audit packages were not added to the application manifest.

Coverage includes first visits, returning guests, one/two-ticket layouts, keyboard scanning, reduced motion, data saver/2G, English/Malay, validation/correction, success/duplicate/decline/mixed RSVP receipts, aborted requests, blocked storage, corrupt drafts, failed chunks, older browser APIs, hash history, calendar event scope and stable UIDs. Browser RSVP responses are isolated mocks; server validation and spreadsheet behavior are tested with controlled fixtures.

Responsive inspection covers widths 360, 375, 390, 412, 430, 768 and 1440, plus 844 × 390 landscape. Enlarged-text checks include Malay at 125% and practical details/RSVP at 200%. Updated screenshots were reviewed. These checks do not reproduce every physical-device keyboard, safe-area or OS text-size setting.

## Privacy, media and wedding-day details

- No analytics, tracking services or application dependencies were added. Temporary axe/Lighthouse tools and raw audit outputs are confined to ignored `work/` files.
- Access credentials and unfinished RSVP answers remain in local browser storage for the existing returning/retry experience. Empty drafts are no longer written automatically; confirmed or explicitly cleared drafts are removed. The interface explains draft persistence and storage failure. Changing invitations deliberately preserves other drafts.
- The invitation is a public static application: code hashes, event definitions and calendar files can be inspected. Codes separate invitation experiences; they are not server-side secrecy or household authentication. Guest lists, spreadsheet identifiers and backend secrets must remain private.
- Cloud video is approximately 1.35 MB, silent in the interface, and optional. There is no separate music/audio flow to test. Responsive AVIF/WebP cabin images, compressed gate imagery, posters and self-hosted fonts preserve the existing design. Fast Track never mounts journey media.
- Read-only production checks found HTTPS and HTTP-to-HTTPS redirection, canonical/social metadata, noindex/nofollow/noarchive, no-referrer policy, CSP, and working social-image/favicon responses. The production page was not updated by this audit.
- The displayed Terminal 3 address and MRT/Jewel connections agree with the hotel's [official directions](https://changiairport.crowneplaza.com/getting-here). Wedding dates, programme, deadline, ballroom booking and attendance limits remain owner-supplied facts; no booking confirmation was available.

## Remaining release checks

1. **Release build configuration:** plain `npm run build` rejects missing/invalid local values for all eight invitation-code hashes. The validation build uses the public `e2e/test-config.ts` hashes, RSVP preview status, and no live endpoint. Configure and verify the actual release environment before publishing; do not deploy the fixture artifact.
2. **Live RSVP:** actual Apps Script properties, permissions, deployment version, Google receipt delivery and spreadsheet writes were not verified. Deploy the updated `Code.gs` through the existing release process and perform controlled attending/declining/retry checks before opening RSVP.
3. **Physical phones:** save each appropriate calendar on a physical iPhone in Safari and when arriving from WhatsApp/in-app browsers; repeat on Android and desktop calendar clients. WebKit/Chromium link downloads do not prove native calendar import. The suspected iOS cause is addressed, but the original failure is not confirmed fixed until this check passes.
4. **Manual accessibility:** physical VoiceOver/TalkBack, voice control, large OS text, mobile keyboards and notches remain unverified. Automated results do not establish full WCAG conformance; transparent/gradient ticket surfaces also required manual contrast calculations.
5. **Performance in the field:** local synthetic results do not establish real-device INP, actual cellular transfer times or WhatsApp caching behavior. The measured mobile LCP remains above the 2.5-second goal; a larger rendering/asset strategy change was not made solely to improve a score.
6. **Guest support:** no approved wedding-day phone/WhatsApp contact is configured. Contact details were left unchanged rather than inventing a recipient. Confirm the preferred fallback for guests who need help.
