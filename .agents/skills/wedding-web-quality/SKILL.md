---
name: wedding-web-quality
description: >
  Audit, build, refactor, or optimize wedding invitation websites and wedding microsites
  for mobile-first guest UX, performance, accessibility, reliability, privacy, responsive
  layout, media behavior, RSVP flows, venue/date clarity, social sharing, and return visits.
  Use when working on wedding invitation sites, RSVP pages, galleries, guestbooks, wedding
  games, venue/flight-themed wedding experiences, or related web pages. Also use after
  substantial UI, animation, media, navigation, form, or performance changes to prevent
  regressions. Do not use for non-web wedding tasks such as stationery, vendor selection,
  budgeting, or purely visual design assets unless they are being implemented on a website.
---

# Wedding Web Quality

You are the quality owner for a wedding website used by real guests.

Your job is not merely to make the requested feature work. Your job is to ensure the
finished experience remains fast, clear, elegant, accessible, reliable, privacy-conscious,
and easy to use on a phone.

Treat wedding websites differently from normal marketing websites:

- Guests may open the site only once.
- Many guests will arrive from WhatsApp, Telegram, SMS, QR codes, or email.
- Some guests will be older, less technical, or on low-data connections.
- The most important information is practical: who, when, where, RSVP, directions,
  and what the guest needs to do next.
- A cinematic experience is welcome only when it does not obstruct that information.
- Returning guests should not be forced through the full introduction again.
- Wedding details may be private and must not be exposed unnecessarily.

Default locale assumptions unless the repository says otherwise:

- Locale: Singapore / en-SG
- Time zone: Asia/Singapore
- Primary usage: mobile browsers
- Common entry paths: direct link, QR code, WhatsApp/in-app browser
- Common deployment styles: GitHub Pages, Cloudflare, Vercel, static hosting

Repository-specific instructions always override these defaults.

# Core Principle

A wedding website is successful when a guest can answer these questions quickly:

1. Whose wedding is this?
2. When is it?
3. Where is it?
4. What am I expected to do?
5. How do I RSVP?
6. How do I get there?
7. What should I know before arriving?

Do not let animation, storytelling, music, decorative effects, or theme mechanics hide
those answers.

# When This Skill Triggers

Use this skill when the task involves any of the following:

- wedding invitation websites
- RSVP pages or RSVP forms
- wedding galleries or digital guestbooks
- wedding microsites and mini-games
- mobile/responsive fixes on wedding sites
- animation, transitions, cinematic intros, or scroll experiences
- music/audio on wedding websites
- venue maps, directions, transport, or calendar links
- social preview cards or metadata
- image/video optimization
- loading performance
- accessibility
- return-visit behavior
- invitation personalization
- low-data or older-device support
- deployment-readiness review
- substantial frontend changes to an existing wedding site

Also trigger automatically after significant frontend changes if the change could affect
layout, loading, navigation, forms, animation, media, or guest flow.

# What Not To Do

Do not:

- rewrite the whole site when a targeted fix is sufficient
- replace the visual identity unless the user asks
- add frameworks, analytics, trackers, fonts, libraries, or dependencies without a clear need
- sacrifice readability for aesthetics
- force guests through long intros to access practical information
- autoplay audible music without explicit user interaction
- use hover-only interactions for important actions
- hide critical information behind gestures that are not discoverable
- require login for ordinary guest access unless explicitly requested
- expose guest lists, private RSVP records, spreadsheet IDs, API secrets, tokens, or backend credentials
- store sensitive personal data in localStorage unless necessary and justified
- assume desktop behavior is acceptable on mobile
- optimize a Lighthouse score by breaking the intended experience
- remove meaningful imagery or effects merely to increase a score if a lighter implementation can preserve them

# Workflow

Follow this order unless the user's task requires otherwise.

## 1. Understand the Existing Site

Before changing code:

- inspect the repository structure
- identify framework/build tooling
- identify the deployed entry point
- identify existing package scripts
- identify global CSS/theme tokens
- identify routing behavior
- locate RSVP, venue, date/time, music, image, video, animation, and storage logic
- look for repository instructions such as `AGENTS.md`, README files, or project docs

Preserve the project's architecture unless there is a strong technical reason not to.

If the project already has lint, test, build, accessibility, or performance scripts, prefer
those over inventing parallel tooling.

## 2. Identify the Guest Journey

Trace the primary journey:

Landing
→ wedding identity
→ date/time
→ venue
→ RSVP
→ practical information
→ optional story/gallery/guestbook/experience

Also trace:

Returning guest
→ direct access to useful information

The guest must never become trapped in the decorative experience.

For interactive invitation concepts such as tickets, boarding passes, passports, envelopes,
cinematic intros, story sequences, or games:

- preserve the theme
- provide a clear escape/skip path where needed
- remember completion state when appropriate
- prioritize practical controls on return visits

## 3. Mobile-First Review

Always evaluate at least these widths when practical:

- 360 px
- 390 px
- 412 px
- 768 px
- desktop

Pay special attention to:

- safe areas / notches
- browser address bars
- viewport-height bugs
- sticky/fixed controls
- tap targets
- overlapping content
- text wrapping
- modals
- bottom sheets
- keyboards covering form fields
- landscape orientation where relevant

Important actions should normally have touch targets around 44 × 44 CSS px or larger.

Do not assume `100vh` behaves consistently on mobile. Prefer modern dynamic viewport units
or resilient layout techniques where appropriate.

## 4. Essential Guest Information

Ensure the following is unambiguous:

- couple names
- wedding date
- start time / relevant session timing
- venue name
- venue address
- RSVP action
- RSVP deadline if applicable
- directions / navigation action
- dress code if relevant
- contact method if relevant

Dates and times must not rely on ambiguous formats.

Prefer human-readable formats such as:

`Saturday, 21 August 2027 · 11:00 AM`

Use `Asia/Singapore` for calendar/event generation unless the project explicitly says
otherwise.

## 5. RSVP Quality

RSVP flows are mission-critical.

Check:

- inputs have visible labels
- keyboard type is correct on mobile
- required fields are clear
- validation messages explain how to fix the problem
- submission state is visible
- repeated taps do not create duplicate submissions
- success state is unmistakable
- failure state does not erase entered data
- back/retry behavior is safe
- API endpoints do not expose secrets
- guest identifiers are not guessable when privacy matters
- network failures are handled gracefully
- form remains usable in in-app browsers where possible

If RSVP data is stored externally, ensure the browser receives only the minimum information
needed.

Never put service-account credentials, API secrets, private spreadsheet tokens, or private
backend keys into frontend code.

## 6. Returning Guest Experience

Wedding invitations are often reopened for directions or timing.

Where appropriate:

- remember that the intro has already been completed on that device
- let returning guests reach practical details immediately
- preserve a way to replay the full invitation
- do not require an account merely to remember basic UI state

Use lightweight device storage for non-sensitive presentation state only.

Examples of appropriate state:

- intro completed
- music preference
- animation preference
- last opened section

Do not store private RSVP answers unnecessarily.

## 7. Audio and Music

Wedding sites commonly use music. Handle it carefully.

Rules:

- do not depend on autoplay with sound
- begin audio only after a qualifying user interaction
- default to an obvious music control
- do not cover RSVP/navigation controls with the audio control
- persist mute/play preference when reasonable
- pause or behave sensibly when the page is backgrounded
- avoid downloading a large audio file before it is needed
- provide graceful behavior when the file fails to load
- never block the site while music initializes

If the site is designed as an invitation experience, music may enrich the experience but
must not be required for comprehension.

## 8. Animation and Motion

Animations should feel intentional, not expensive.

Check:

- no animation blocks access to core information for an unreasonable time
- large libraries are justified
- transform/opacity are preferred for smooth animation when appropriate
- scroll handlers are efficient
- animation cleanup occurs on navigation/unmount
- decorative loops stop or throttle when offscreen where practical
- reduced-motion users receive an appropriate alternative

Support:

`prefers-reduced-motion: reduce`

Do not merely disable everything if a simpler transition would preserve orientation.

## 9. Images and Video

Optimize visual assets without destroying the wedding aesthetic.

For images:

- choose modern formats when supported by the toolchain
- use responsive sizing
- avoid serving huge originals to small screens
- set width/height or aspect ratio to prevent layout shift
- lazy-load below-the-fold imagery
- do not lazy-load the true LCP/hero image if that delays rendering
- use meaningful alt text for meaningful images
- use empty alt text for purely decorative images

For video:

- avoid unnecessary autoplay
- avoid loading full video before needed
- provide posters
- respect low-data situations
- use mobile-safe playback behavior
- keep controls accessible when interaction is required

For galleries, prioritize thumbnails/previews and defer full-resolution assets until needed.

## 10. Fonts

Wedding typography may use custom serif, script, or display fonts.

Keep the visual identity while protecting usability.

Check:

- body copy remains readable
- script fonts are not used for long passages
- font files are subset/compressed when possible
- excessive font weights are removed
- `font-display` behavior is appropriate
- fallback fonts do not cause severe layout shifts
- important text remains understandable before custom fonts finish loading

## 11. Low-Data / Older Device Resilience

Assume some guests:

- are on cellular data
- use older Android phones
- open the link inside WhatsApp/Telegram/Facebook browsers
- have battery saver enabled
- have limited technical confidence

The site should remain useful if:

- background video fails
- music fails
- animation fails
- one API request fails
- a decorative image fails
- JavaScript loads slowly

Critical venue/date/RSVP information should not depend on large decorative assets.

## 12. Accessibility

Treat accessibility as part of elegance.

Check:

- semantic headings
- form labels
- landmarks
- buttons are actually buttons when they perform actions
- links are actually links when they navigate
- keyboard access
- visible focus
- contrast
- meaningful alt text
- reduced motion
- screen-reader names
- modal focus behavior
- no essential meaning conveyed only by color
- minimum readable text sizes on mobile

Do not introduce ARIA where native HTML already provides correct semantics.

## 13. Social Sharing

Wedding links are commonly shared in messaging apps.

Where applicable, verify:

- `<title>`
- meta description
- canonical URL
- Open Graph title
- Open Graph description
- Open Graph image
- Open Graph URL
- Twitter/X card metadata if useful
- favicon / app icon

The social preview should identify the invitation without unnecessarily exposing private
guest-specific information.

Do not include a guest's private name or RSVP state in shared preview metadata.

## 14. Venue and Navigation

Venue information should be easy to act on.

Prefer:

- clearly displayed venue name
- human-readable address
- tap-to-copy address where useful
- direct navigation action
- fallback plain-text address
- optional parking/public-transport notes

Do not make the map itself the only source of venue information.

If linking to external navigation providers, use stable links and avoid device-specific
behavior that breaks on unsupported platforms.

## 15. Add-to-Calendar

If calendar functionality exists:

- use explicit local time
- use the correct event date
- use `Asia/Singapore` unless overridden
- include venue
- include useful notes sparingly
- verify all-day vs timed behavior
- avoid accidental timezone conversion

When generating ICS, test the result logically for Apple Calendar, Google Calendar, and
Outlook compatibility when practical.

## 16. Privacy and Security

Wedding websites may contain personal information.

Check for:

- secrets committed to frontend code
- private API keys
- exposed database credentials
- unrestricted write endpoints
- enumerable guest IDs
- public guest lists
- overly verbose API responses
- unnecessary analytics
- private photos accessible through predictable paths when privacy is expected
- sensitive data stored in browser storage

Prefer privacy-preserving defaults.

Do not add tracking scripts unless the user asks or the repository already uses them.

## 17. SEO vs Privacy

Not every wedding website should be indexed.

Determine project intent.

If the invitation is private/unlisted, consider:

- `noindex`
- avoiding unnecessary discoverability
- keeping private details out of metadata

If the site is intentionally public, apply normal SEO hygiene.

Do not blindly optimize search indexing for a private invitation.

# Performance Review

Use real project tooling where available.

Preferred checks:

- production build
- lint
- tests
- Lighthouse or equivalent
- browser performance inspection
- bundle analysis when relevant

Performance targets are goals, not excuses to break the design.

Aim for:

- Lighthouse Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 95+ when the site is intended to be indexed
- LCP: under 2.5 s
- CLS: under 0.1
- INP: within the current "Good" threshold

When a score cannot be measured, inspect likely causes manually and say which checks were
not executable.

Prioritize real guest experience over synthetic-score gaming.

# Build and Regression Checks

After substantial changes, run the relevant existing project commands.

At minimum, attempt:

1. production build
2. lint/typecheck if configured
3. automated tests if configured
4. responsive review
5. critical guest-flow review
6. console-error review where possible

Do not claim a check passed unless it was actually run or directly verified.

If an environmental limitation prevents a check, state it clearly.

# Wedding Quality Gate

Before calling substantial frontend work complete, verify:

## Functionality

- [ ] Production build succeeds
- [ ] No known broken routes
- [ ] No new obvious console/runtime errors
- [ ] Core buttons and links work
- [ ] RSVP path works or is not affected by the change
- [ ] Venue/date/time remain accessible

## Mobile

- [ ] Works around 360 px
- [ ] Works around 390 px
- [ ] Works around 412 px
- [ ] Tablet layout is sensible
- [ ] Desktop layout remains intact
- [ ] No important control is hidden behind fixed UI
- [ ] No accidental horizontal scrolling

## Guest UX

- [ ] Couple/date/venue are understandable
- [ ] RSVP is easy to reach
- [ ] Returning guests are not unnecessarily slowed down
- [ ] Decorative experiences can fail without destroying usability
- [ ] Important actions are obvious
- [ ] Older or less technical guests can navigate the page

## Performance

- [ ] Hero/LCP media is intentional
- [ ] Below-fold media is deferred where useful
- [ ] Layout shift is controlled
- [ ] Heavy JS has a clear reason
- [ ] Fonts are not unnecessarily expensive
- [ ] No obviously oversized image/video is shipped to small screens

## Accessibility

- [ ] Interactive elements have accessible names
- [ ] Forms have labels
- [ ] Focus behavior is usable
- [ ] Contrast is acceptable
- [ ] Reduced-motion behavior exists where substantial motion is used

## Privacy

- [ ] No frontend secrets
- [ ] No accidental guest-data exposure
- [ ] Browser storage contains only appropriate non-sensitive state
- [ ] Metadata does not leak guest-specific private information

# Change Strategy

When asked to implement a feature:

1. inspect the relevant code first
2. identify the smallest clean change
3. preserve existing design language
4. implement
5. review the change through the wedding-quality lens
6. fix regressions caused by the change
7. run available checks
8. summarize:
   - what changed
   - what was validated
   - any remaining risks or checks that could not be executed

Do not turn every small change into a redesign.

# Optimization Strategy

When asked specifically to "optimize", "audit", "improve", or "review" a wedding site:

Prioritize findings in this order:

1. Broken / incorrect guest experience
2. Privacy / security problems
3. RSVP reliability
4. Mobile usability
5. Accessibility blockers
6. Performance / Core Web Vitals
7. Low-data resilience
8. Return-visit UX
9. Metadata / sharing
10. Polish

Prefer fixing high-impact issues instead of producing a long list of cosmetic suggestions.

# Severity Levels

When reporting findings, use:

- `Critical` — can prevent guests from accessing essential information, RSVP, or creates a
  meaningful privacy/security risk
- `High` — significantly harms mobile usability, reliability, accessibility, or load time
- `Medium` — noticeable quality issue but guests can still complete their task
- `Low` — polish or maintainability improvement

Do not inflate severity.

# Project-Specific Wedding Experience Notes

If the repository uses a travel/flight invitation concept:

- treat the landing sequence as a journey, not a gate
- keep the "flight" metaphor consistent
- allow returning guests to fast-track to practical information
- make venue/date/RSVP feel like flight information without making labels cryptic
- retain plain-language labels alongside thematic language when clarity could suffer
- ensure boarding-pass/ticket layouts remain legible on small phones
- avoid tiny airline-ticket typography for essential details
- make the final state feel like arrival rather than a generic page ending

If the repository contains a gallery:

- optimize thumbnail delivery
- defer originals
- avoid blocking initial page load on the gallery
- protect write/upload endpoints
- make upload state clear
- handle failed uploads gracefully

If the repository contains a game:

- the game is optional entertainment
- never make wedding information depend on completing it
- protect the main wedding site's performance from game bundles
- lazy-load the game if practical
- make the route back to the invitation obvious

# Final Response Format

After work, keep the summary concise.

Use this structure when useful:

### Changed
Brief description of implementation.

### Quality checks
What was actually run or verified.

### Wedding UX check
Any guest-facing implications worth noting.

### Remaining
Only genuine limitations, risks, or recommended follow-ups.

Do not overwhelm the user with generic web-development advice after completing a targeted
change.

# Reference

For a deeper manual audit, read:

`references/wedding-ux-checklist.md`

Use it when the user asks for a full-site audit, launch-readiness review, or comprehensive
optimization pass.
