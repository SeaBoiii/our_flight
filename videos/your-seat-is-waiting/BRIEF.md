---
workflow: general-video
flow: automation
storyboard: yes
message: "Someone has saved you a seat. Confirm it."
destination: whatsapp-instagram-stories
aspect: 1080x1920
language: en, ms
audience: wedding guests of Aleem & Nurulain (family and friends, all ages), watching on phones
length: 60s
angle: guest-pov cinematic trailer
voice: George (ElevenLabs eleven_v4), warm cinematic male narrator
---

## Intent

An epic, cinematic, unforgettable wedding trailer for "Our Flight", the
Aleem & Nurulain wedding invitation (Crowne Plaza Changi Airport, Singapore,
21 & 22 August 2027).

Chosen concept, #3 **Your Seat Is Waiting**, with #2's title-card hits: the
guest is the protagonist. Their phone lights up with an invitation; they walk
a quiet dawn terminal, find seat 21A by the window, and as the clouds part the
window frames *Aleem & Nurulain*. The narrator speaks to *you*: "Someone has
saved you a seat." The RSVP is the climax, framed as **"Confirm your seat"**.
Black title cards land on music hits.

The user's words: "make it epic, make it cinematic. a trailer that people
can't forget… Make it extraordinary."

## Assets

- ../../public/flight/*.avif|webp, ../../artwork/flight/*.png: airport, runway, cabin window, sky, golden-hour skies and aircraft from the invitation (Golden Hour Departure).
- ../../artwork/video/gate-cinemagraph-portrait-master.mp4: Veo loop of the blue-hour terminal.
- ../../artwork/stationery/wax-seal.png and cotton-paper.png: blank wax seal and paper texture.
- ../../public/monogram-a-and-n.png: the original A&N monogram. Use it as-is; never redraw it.
- C:\Users\seabo\Downloads\qr-code.svg: the RSVP QR code (navy/gold, monogram centre). It belongs on the final call-to-action card.
- ../../artwork/audio/our-song-master.mp3: "Untamable Love" by Kurtz Martin (Uppbeat). This is the music spine.
- RSVP link: rsvp.aleemxnurul.love

## Customizations

- Two language versions: English narration with English captions, and Bahasa Melayu narration with Malay captions. Same picture, separate VO and captions.
- Sound: the user's song plus ambient layers (terminal ambience, jet rumble, whooshes and impacts on title hits). Duck and carve the song under the voice.
- Burned-in captions for sound-off phone viewing.
- New cinematic shots generated from the site's artwork: Veo 3.1 image-to-video, plus stills from Nano Banana Pro (gemini-3-pro-image) or OpenAI gpt-image-2.5-sunburst. Keep first frames faithful to the existing art.
- Narration TTS: audition Gemini and OpenAI voices (ElevenLabs if the user adds a key) and present 2–3 samples at the sketch review.

## Notes

- Vertical video means the viewer can't scan a QR code from their own screen. The end card leads with rsvp.aleemxnurul.love in large type, shows the QR beside it, and reminds guests to use the invitation code from their message. Never show any invitation code.
- Faceless world: no couple photos were supplied. Don't invent people's faces; silhouettes or hands are OK only if they read as the anonymous guest.
- Design language: DESIGN_LANGUAGE.md at the repo root (navy #033A4E, gold #D9B472, ivory, golden-hour ramp, Instrument Serif and IBM Plex Mono, songket pucuk rebung).
- Music licence: Uppbeat free creator licence; the user should confirm use in a shared video.
