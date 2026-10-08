/* global document */
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// A code-native layout keeps the couple's names crisp and the original monogram exact.
// Golden Hour Departure: midnight Changi, a departures board and champagne gold.
const root = new URL('../', import.meta.url);
const data = async (file, mime) => `data:${mime};base64,${(await readFile(new URL(file, root))).toString('base64')}`;
const [airport, font, italic, mono, logo] = await Promise.all([
  data('public/flight/airport-landscape-1440.webp', 'image/webp'),
  data('src/assets/fonts/instrument-serif-latin-400.woff2', 'font/woff2'),
  data('src/assets/fonts/instrument-serif-latin-400-italic.woff2', 'font/woff2'),
  data('src/assets/fonts/ibm-plex-mono-latin-500.woff2', 'font/woff2'),
  data('public/monogram-a-and-n-display.png', 'image/png'),
]);
const songket = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='16' viewBox='0 0 28 16' fill='none' stroke='%23c9a465' stroke-width='.9'%3E%3Cpath d='M0 15.5h28M2 15.5 7 3l5 12.5M16 15.5 21 3l5 12.5'/%3E%3Cpath d='M4.6 15.5 7 9.3l2.4 6.2M18.6 15.5 21 9.3l2.4 6.2' opacity='.7'/%3E%3C/svg%3E";
const flaps = (text) => [...text].map((letter) => `<i>${letter === ' ' ? '&nbsp;' : letter}</i>`).join('');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:Invitation;src:url('${font}')}
    @font-face{font-family:Invitation;font-style:italic;src:url('${italic}')}
    @font-face{font-family:Board;font-weight:500;src:url('${mono}')}
    *{box-sizing:border-box}body{margin:0;background:#04121b;color:#f8f3ea;font-family:Board,monospace}
    main{position:relative;width:1200px;height:630px;padding:54px 72px;overflow:hidden;
      background:radial-gradient(70% 80% at 85% 10%,#e3a37c33,transparent 60%),linear-gradient(90deg,#04121bf0 0%,#04121bb3 55%,#04121b80 100%),url('${airport}') center/cover}
    main::after{content:'';position:absolute;left:0;right:0;bottom:0;height:16px;background:url("${songket}") repeat-x 0 0/28px 16px;opacity:.7}
    header{display:flex;align-items:center;gap:18px;font-size:13px;letter-spacing:4px;color:#ead3a2}
    header img{width:78px;filter:brightness(0) invert(1);opacity:.95}
    .board{display:flex;gap:28px;margin-top:46px}.board div{display:grid;gap:8px}
    .board small{font-size:11px;letter-spacing:3px;color:#ead3a2;opacity:.85}
    .board span{display:flex;gap:3px}.board i{font-style:normal;display:grid;place-items:center;width:24px;height:34px;border-radius:4px;font-size:19px;
      background:linear-gradient(180deg,#13303f 0 49%,#04121b 49% 51%,#0e2734 51%);box-shadow:inset 0 1px 0 #ffffff14}
    .board .status i{color:#d9b472}
    h1{font-family:Invitation,serif;font-weight:400;font-size:116px;line-height:.92;letter-spacing:-3.5px;margin:40px 0 16px}
    h1 em{font-style:italic;font-size:.62em;color:#d9b472}
    p{font-family:Invitation,serif;font-style:italic;font-size:30px;color:#f8f3eac2;margin:0}
    footer{position:absolute;left:72px;right:72px;bottom:44px;display:flex;justify-content:space-between;padding-top:18px;border-top:1px solid #d9b47255;font-size:12px;letter-spacing:3px;color:#ead3a2}
  </style></head><body><main>
    <header><img src="${logo}" alt="">OUR FLIGHT · A WEDDING INVITATION</header>
    <div class="board"><div><small>FLIGHT</small><span>${flaps('AN2108')}</span></div><div><small>TO</small><span>${flaps('FOREVER')}</span></div><div><small>STATUS</small><span class="status">${flaps('ON TIME')}</span></div></div>
    <h1>Aleem <em>&amp;</em> Nurulain</h1><p>Two hearts. One destination.</p>
    <footer><span>AUGUST 2027</span><span>CROWNE PLAZA · CHANGI AIRPORT</span></footer>
  </main></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('public/og.jpg', root)), type: 'jpeg', quality: 88 });
  console.log('Rendered public/og.jpg (1200 × 630)');
} finally {
  await browser.close();
}
