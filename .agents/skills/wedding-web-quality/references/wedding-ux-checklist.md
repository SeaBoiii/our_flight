# Wedding Website Manual Audit Checklist

Use this reference for a comprehensive launch-readiness review.

## 1. First 10 Seconds

A first-time guest should quickly understand:

- who is getting married
- that this is an invitation
- the date
- what action is available next

Flag any experience that looks beautiful but makes the guest wonder what to do.

## 2. First 30 Seconds

A guest should be able to locate:

- venue
- timing
- RSVP
- directions

If these are intentionally deeper in a cinematic invitation, ensure there is a skip/fast
path.

## 3. Returning Visit

Simulate a guest reopening the invitation on the wedding day.

Ask:

- can they get the address quickly?
- can they see the start time quickly?
- can they open navigation quickly?
- do they have to replay an intro?
- does music unexpectedly start?
- does the site remember sensible non-sensitive preferences?

## 4. Phone Matrix

Review:

- 360 × 800 class Android
- 390 × 844 class iPhone
- 412 × 915 class Android
- tablet portrait
- desktop

Check:

- safe-area spacing
- fixed bottom controls
- sticky headers
- modal sizing
- keyboard overlap
- landscape surprises
- oversized headings
- long names
- long venue addresses

## 5. Older Guest Test

Pretend the guest:

- does not know the site's theme
- ignores animation hints
- does not swipe unless told
- has larger system text
- taps the most obvious button
- expects browser back to work

The interface should still make sense.

## 6. Low-Data Test

Consider slow 4G / congested mobile data.

The page should reveal useful content before:

- large galleries
- background video
- long audio
- nonessential animation libraries
- decorative assets

## 7. RSVP Test

Test:

- empty submission
- invalid data
- double tap
- slow network
- offline/failure response
- server error
- successful submission
- returning after submission
- back navigation
- refresh during/after submission

Never lose the guest's typed data on a recoverable error if avoidable.

## 8. Messaging-App Browser Test

Where practical, test behavior when opened from:

- WhatsApp
- Telegram
- Instagram/Facebook in-app browser

Pay particular attention to:

- downloads
- calendar links
- maps/navigation
- audio
- clipboard behavior
- file uploads
- window.open / target=_blank behavior

## 9. Accessibility Pass

Verify:

- heading hierarchy
- page language
- link purpose
- button labels
- form labels
- error announcements
- keyboard navigation
- focus visibility
- image alternatives
- reduced motion
- contrast
- text scaling

## 10. Media Pass

Images:

- dimensions reserved
- correct responsive size
- modern format where appropriate
- meaningful alt text
- lazy loading below fold

Video:

- poster
- preload strategy
- muted autoplay only when justified
- no dependency on video for essential information

Audio:

- explicit interaction before sound
- visible control
- preference persistence where helpful
- graceful failure

## 11. Wedding-Day Mode

Consider whether the invitation should become more practical as the date approaches.

Useful options may include:

- prominent venue button
- directions
- ceremony/session time
- parking/transit note
- contact action

Do not add a time-sensitive mode unless the user wants it.

## 12. After-Wedding Mode

If the invitation remains online after the wedding, consider:

- gallery emphasis
- thank-you message
- guestbook
- reduced RSVP prominence

Preserve useful memories without confusing late visitors.

## 13. Metadata / Sharing

Test the shared URL preview.

Check:

- title
- description
- image crop
- no private guest name leakage
- correct canonical URL

## 14. Security / Privacy

Search the codebase for:

- API keys
- secrets
- service account JSON
- spreadsheet identifiers used with insecure endpoints
- hard-coded admin tokens
- guest records in client bundles
- unrestricted storage uploads
- open write APIs

Distinguish public identifiers from actual secrets, but minimize unnecessary exposure.

## 15. Deployment

Before launch:

- production build
- HTTPS
- custom domain
- canonical redirects
- 404 behavior
- SPA fallback if needed
- caching rules
- asset paths
- base URL configuration
- social preview from production URL
- robots behavior appropriate to private/public intent

## 16. Final Human Test

Do one clean-device mental pass:

1. Receive link in WhatsApp.
2. Tap link.
3. Understand invitation.
4. Find date.
5. Find venue.
6. RSVP.
7. Add date to calendar.
8. Close site.
9. Reopen site later.
10. Get directions.

If any step feels confusing, treat that as a real product issue.
