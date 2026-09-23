/* global document */
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// A code-native layout keeps the couple's names crisp and the original monogram exact.
const root = new URL('../', import.meta.url);
const data = async (file, mime) => `data:${mime};base64,${(await readFile(new URL(file, root))).toString('base64')}`;
const [airport, font, logo] = await Promise.all([
  data('public/flight/airport-landscape-1440.webp', 'image/webp'),
  data('src/assets/fonts/instrument-serif-latin-400.woff2', 'font/woff2'),
  data('public/monogram-a-and-n-display.png', 'image/png'),
]);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:Invitation;src:url('${font}')}*{box-sizing:border-box}body{margin:0;background:#081b31;color:#f7f2e8;font-family:Arial,sans-serif}
    main{position:relative;width:1200px;height:630px;padding:58px 72px;background:linear-gradient(90deg,#081b3177,#081b31bb),url('${airport}') center/cover}
    header{display:flex;align-items:center;gap:17px;font-size:12px;letter-spacing:3px}header img{width:70px;background:#f7f2e8;padding:6px;border-radius:2px}
    h1{font-family:Invitation,serif;font-weight:400;font-size:118px;line-height:.95;letter-spacing:-3px;margin:68px 0 20px}h1 span{color:#d0b789}
    p{font-family:Invitation,serif;font-size:29px;color:#ded1bb;margin:0}footer{display:flex;justify-content:space-between;margin-top:76px;padding-top:20px;border-top:1px solid #c4a36766;font-size:11px;letter-spacing:2px;color:#dcc6a0}
  </style></head><body><main><header><img src="${logo}" alt="">OUR FLIGHT · A WEDDING INVITATION</header><h1>Aleem <span>&amp;</span> Nurulain</h1><p>Two hearts. One destination.</p><footer><span>AUGUST 2027</span><span>CROWNE PLAZA · CHANGI AIRPORT</span></footer></main></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('public/og.jpg', root)), type: 'jpeg', quality: 88 });
  console.log('Rendered public/og.jpg (1200 × 630)');
} finally {
  await browser.close();
}
