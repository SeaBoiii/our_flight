// Writes index.html for one of the four trailer cuts (language × date). Picture and
// music are shared; the narration, captions and on-screen text swap per cut.
// A project may only have one root composition, so cuts are rendered one at a time:
//
//   node scripts/cuts.mjs ms-22        # index.html becomes the BM · 22 August cut
//   node scripts/cuts.mjs              # back to the default EN · 21 August cut
//   node scripts/cuts.mjs ms-21 --voice=george  # same cut narrated by George instead of Clyde
//   node scripts/render-all.mjs        # renders all four into renders/
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

// Scene slots, bar-aligned to the music edit (112.3 BPM).
const SCENES = [
  ['f01-invitation', '01-invitation', 0, 6.47],
  ['f02-august', '02-august', 6.47, 4.29],
  ['f03-terminal', '03-terminal', 10.76, 6.42],
  ['f04-seat', '04-seat', 17.18, 6.41],
  ['f05-journeys', '05-journeys', 23.59, 4.3],
  ['f06-takeoff', '06-takeoff', 27.89, 8.54],
  ['f07-clouds', '07-clouds', 36.43, 6.42],
  ['f08-names', '08-names', 42.85, 4.28],
  ['f09-date', '09-date', 47.13, 6.42],
  ['f10-confirm', '10-confirm', 53.55, 8.23],
];

// Narration placement (global seconds). Line lengths are measured from the files themselves.
const VO = { f01: 1.0, f03: 11.3, f04: 17.6, f05: 23.75, f07: 36.9, f08: 43.3, f09: 47.5, f10: 53.9 };

// Narrator voices (ElevenLabs). Clyde is the chosen narrator; pass --voice=george for the alternate.
const VOICES = { george: { dir: 'vo', label: 'George' }, clyde: { dir: 'vo-clyde', label: 'Clyde' } };
const voiceArg = process.argv.find((a) => a.startsWith('--voice='));
const voice = VOICES[(voiceArg ? voiceArg.slice(8) : 'clyde').toLowerCase()];
if (!voice) { console.error(`voice must be one of: ${Object.keys(VOICES).join(', ')}`); process.exit(2); }
const lengthOf = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
  { cwd: new URL('..', import.meta.url) }).toString().trim());

// Burned-in captions only where the words are not already on screen.
const CAPTIONS = {
  en: {
    f01: 'Every great journey… begins with an invitation.',
    f03: "You'll walk through Changi… at first light.",
    f04: "…to a seat that's been saved, just for you.",
    f07: 'And above the clouds… two hearts find one destination.',
  },
  ms: {
    f01: 'Setiap perjalanan yang indah… bermula dengan sebuah jemputan.',
    f03: 'Anda akan melangkah di Changi… ketika fajar menyingsing.',
    f04: '…menuju sebuah kerusi yang dikhaskan, hanya untuk anda.',
    f07: 'Dan di atas awan… dua hati menemui satu destinasi.',
  },
};

const TEXT = {
  en: {
    'f01-invitation': {},
    'f02-august': {},
    'f03-terminal': {},
    'f04-seat': {},
    'f05-journeys': {},
    'f06-takeoff': {},
    'f07-clouds': {},
    'f09-date': { inviteLine: 'invite you to celebrate with them', venueLine: 'Crowne Plaza · Changi Airport', hostSize: 190 },
    'f10-confirm': {},
  },
  ms: {
    'f01-invitation': {
      notifLine: 'Anda telah dijemput.', passengerKey: 'Penumpang', passengerValue: 'Anda', seatKey: 'Kerusi',
      destKey: 'Destinasi', destValue: 'Selamanya', dateKey: 'Tarikh', dateValue: 'Ogos 2027', gateLine: 'Pintu akan dibuka',
    },
    'f02-august': { monthLine: 'Ogos', placeLine: 'Singapura' },
    'f03-terminal': { destination: 'SELAMANYA', status: 'BERLEPAS' },
    'f04-seat': {
      seatLabel: 'Tempat duduk anda', windowLine: 'Tingkap · Untuk anda', flightKey: 'Penerbangan',
      fromKey: 'Dari', toKey: 'Ke', toValue: 'Selamanya',
    },
    'f05-journeys': { lineA: 'Ada perjalanan', lineB: 'yang mengubah segalanya.' },
    'f06-takeoff': { wheelsLine: 'Berlepas', routeLine: 'SIN → Selamanya' },
    'f09-date': { inviteLine: 'menjemput anda meraikan bersama', venueLine: 'Crowne Plaza · Changi Airport', hostSize: 132 },
    'f10-confirm': {
      leadLine: 'Sebuah kerusi telah dikhaskan untuk anda.', ctaLine: 'Sahkan tempat duduk anda',
      codeLine: 'Gunakan kod dalam jemputan anda', deadlineLine: 'RSVP sebelum 8 Ogos 2027',
    },
  },
};

const DATES = {
  21: {
    flightCode: 'AN2108',
    seat: '21A',
    en: { dayLine: 'SATURDAY · 21 AUGUST 2027', hostLine: 'The Wahabs' },
    ms: { dayLine: 'SABTU · 21 OGOS 2027', hostLine: 'Keluarga Wahab' },
  },
  22: {
    flightCode: 'AN2208',
    seat: '22A',
    en: { dayLine: 'SUNDAY · 22 AUGUST 2027', hostLine: 'The Jamals' },
    ms: { dayLine: 'AHAD · 22 OGOS 2027', hostLine: 'Keluarga Jamal' },
  },
};

// Sound design (global seconds). Each effect gets its own track so nothing overlaps on a lane.
// Volumes are set from each file's measured loudness so effects sit ~4–6 LU under the
// -20 LUFS music bed (jet -4.3, boom -8.4, riser -9.8, whoosh -13.4 LUFS raw).
const SFX = [
  ['chime', 1.2, 2.5, 0.55],
  ['boom', 6.47, 4, 0.17],
  ['terminal', 10.76, 6.42, 0.35],
  ['flap', 11.5, 2.5, 0.45],
  ['flap', 13.4, 2.5, 0.4],
  ['paper', 17.18, 1.5, 0.5],
  ['stamp', 21.46, 1, 0.7],
  ['hit', 23.59, 2.5, 0.55],
  ['riser', 23.4, 4.5, 0.15],
  ['hit', 25.77, 2.5, 0.55],
  ['whoosh', 27.6, 2, 0.25],
  ['jet', 28.3, 8.1, 0.08],
  ['whoosh', 31.7, 2, 0.3],
  ['cabin', 36.43, 6.42, 0.3],
  ['shimmer', 42.95, 3, 0.5],
  ['flap', 50.1, 2.5, 0.35],
  ['seal', 57.13, 1.5, 0.85],
  ['gate', 58.4, 3, 0.45],
];

// Dip-to-midnight joins (global cut times) and gold light-leak joins.
const DIPS = [10.76, 17.18, 42.85, 47.13, 53.55];
const LEAKS = [6.47, 36.43];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;');

function root(lang, date) {
  const d = DATES[date];
  const vars = (id) => {
    const v = { ...(TEXT[lang][id] || {}) };
    if (['f03-terminal', 'f04-seat', 'f06-takeoff'].includes(id)) v.flightCode = d.flightCode;
    if (id === 'f09-date') Object.assign(v, d[lang]);
    // Each date has its own seat: 21A on the 21st, 22A on the 22nd.
    if (id === 'f01-invitation') v.seatValue = d.seat;
    if (id === 'f04-seat') v.seatNumber = d.seat;
    if (id === 'f07-clouds') v.seatLine = lang === 'ms' ? `Kerusi ${d.seat} · Tingkap` : `Seat ${d.seat} · Window`;
    return Object.keys(v).length ? ` data-variable-values='${esc(JSON.stringify(v))}'` : '';
  };
  const scenes = SCENES.map(([id, file, start, dur]) =>
    `      <div id="${id}" class="scene" data-composition-id="${id}" data-composition-src="compositions/frames/${file}.html" data-start="${start}" data-duration="${dur}" data-track-index="0" data-width="1080" data-height="1920"${vars(id)}></div>`).join('\n');
  const lines = Object.fromEntries(Object.entries(VO).map(([f, at]) => {
    const src = `assets/audio/${voice.dir}/${lang}/${f === 'f09' ? `f09-${date}` : f}.mp3`;
    return [f, { at, src, len: lengthOf(src) }];
  }));
  const caps = Object.entries(CAPTIONS[lang]).map(([f, text]) =>
    `      <div id="cap-${f}" class="cap clip" data-start="${lines[f].at}" data-duration="${(lines[f].len + 0.5).toFixed(2)}" data-track-index="5"><span>${esc(text)}</span></div>`).join('\n');
  const vo = Object.entries(lines).map(([f, l]) =>
    `      <audio id="vo-${f}" src="${l.src}" data-start="${l.at}" data-duration="${l.len.toFixed(2)}" data-track-index="6" data-volume="1"></audio>`).join('\n');
  const sfx = SFX.map(([name, at, dur, vol], i) =>
    `      <audio id="sfx-${i}-${name}" src="assets/audio/sfx/${name}.mp3" data-start="${at}" data-duration="${dur}" data-track-index="${20 + i}" data-volume="${vol}"></audio>`).join('\n');
  const label = `${lang.toUpperCase()} · ${date} August`;
  return `<!doctype html>
<!-- Generated by scripts/cuts.mjs (${label}). Edit the script, not this file. -->
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link rel="stylesheet" href="assets/trailer.css" />
    <style>
      @font-face { font-family: "Instrument Serif"; font-style: normal; font-weight: 400; src: url("assets/fonts/instrument-serif-latin-400.woff2") format("woff2"); }
      @font-face { font-family: "Instrument Serif"; font-style: italic; font-weight: 400; src: url("assets/fonts/instrument-serif-latin-400-italic.woff2") format("woff2"); }
      @font-face { font-family: "IBM Plex Mono"; font-style: normal; font-weight: 500; src: url("assets/fonts/ibm-plex-mono-latin-500.woff2") format("woff2"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; overflow: hidden; background: #04121b; }
      #root { width: 100%; height: 100%; position: relative; overflow: hidden; background: #04121b; }
      .scene { position: absolute; inset: 0; }
      /* One caption track: lower third, inside the 9:16 safe zone. */
      .cap { position: absolute; left: 90px; right: 90px; top: 1440px; display: flex; justify-content: center; z-index: 30; }
      .cap span { display: block; max-width: 900px; padding: 18px 30px; border-radius: 14px; text-align: center;
        font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-size: 52px; line-height: 1.15; color: #f8f3ea;
        background: rgba(4, 18, 27, 0.55); }
      /* Finishing layers over every scene. */
      #dip { position: absolute; inset: 0; background: #04121b; opacity: 0; z-index: 20; pointer-events: none; }
      #leak { position: absolute; left: -400px; top: 200px; width: 1880px; height: 1500px; border-radius: 50%; opacity: 0; z-index: 21;
        background: radial-gradient(closest-side, rgba(255, 236, 200, 0.95), rgba(239, 175, 110, 0.55) 45%, rgba(239, 175, 110, 0));
        mix-blend-mode: screen; pointer-events: none; }
      #vignette { position: absolute; inset: 0; z-index: 22; pointer-events: none;
        background: radial-gradient(120% 80% at 50% 45%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.42) 100%); }
      #grain { position: absolute; left: -200px; top: -200px; width: 1480px; height: 2320px; z-index: 23; pointer-events: none; opacity: 0.09;
        mix-blend-mode: overlay;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.4 -.2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E") 0 0 / 240px 240px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="61.78" data-width="1080" data-height="1920">
      <!-- Scenes (bar-aligned to the music edit at 112.3 BPM) -->
${scenes}

      <div id="dip"></div>
      <div id="leak"></div>
      <div id="vignette"></div>
      <div id="grain"></div>

      <!-- Captions (${label}) -->
${caps}

      <!-- Narration: ${voice.label} (ElevenLabs), ${lang === 'en' ? 'English' : 'Bahasa Melayu'} -->
${vo}

      <!-- Music: "Untamable Love" (Kurtz Martin · Uppbeat). One pre-levelled bed built by
           scripts/music-bed.sh: three bar-aligned sections, gain-matched and crossfaded. -->
      <audio id="music" data-timeline-role="music" src="assets/audio/music-bed.mp3" data-start="0" data-duration="61.78" data-track-index="8" data-volume="0.85"></audio>

      <!-- Sound design (ElevenLabs sound effects) -->
${sfx}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      // Dip-to-midnight joins between scenes.
      ${JSON.stringify(DIPS)}.forEach((t) => {
        tl.fromTo("#dip", { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power1.in", immediateRender: false }, t - 0.22)
          .to("#dip", { opacity: 0, duration: 0.4, ease: "power1.out" }, t);
      });
      // Gold light leaks on the music's hits.
      ${JSON.stringify(LEAKS)}.forEach((t) => {
        tl.fromTo("#leak", { opacity: 0, x: 260, scale: 0.8 }, { opacity: 1, x: 0, scale: 1, duration: 0.3, ease: "power2.in", immediateRender: false }, t - 0.3)
          .to("#leak", { opacity: 0, x: -320, scale: 1.2, duration: 1.1, ease: "power2.out" }, t);
      });
      // Film grain: a deterministic jitter, one new offset every 1/24 s.
      const grain = { t: 0 };
      tl.to(grain, { t: 61.78, duration: 61.78, ease: "none", onUpdate: () => {
        const k = Math.floor(grain.t * 24);
        const x = ((k * 7919) % 200) - 100, y = ((k * 104729) % 200) - 100;
        document.getElementById("grain").style.transform = "translate(" + x + "px," + y + "px)";
      } }, 0);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

const cut = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'en-21';
const [lang, date] = cut.split('-');
if (!['en', 'ms'].includes(lang) || !DATES[date]) { console.error('cut must be en-21, en-22, ms-21 or ms-22'); process.exit(2); }
await writeFile(new URL('../index.html', import.meta.url), root(lang, Number(date)));
console.log(`index.html → ${cut} (${voice.label})`);

// Carve each music segment around the narration that plays over it (needs ffmpeg on PATH).
const carve = `${homedir()}/.claude/skills/hyperframes-audio/scripts/carve.mjs`;
if (!process.argv.includes('--no-carve')) {
  // A gentle carve: the bed keeps one steady level and only makes room for the voice.
  execFileSync('node', [carve, '--comp', 'index.html', '--bed', 'music', '--strength', '0.45'], { stdio: ['ignore', 'ignore', 'inherit'], cwd: new URL('..', import.meta.url) });
  console.log('music carved under the narration');
}
