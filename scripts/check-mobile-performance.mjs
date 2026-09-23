/* global window, document */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Run against a production preview. No invitation is unlocked and no RSVP is sent.
const origin = process.env.PERFORMANCE_URL || 'http://127.0.0.1:4180/';
const output = new URL('../outputs/qa/performance/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const runs = [];
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, connectionType: 'cellular4g' });
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      window.__flightMetrics = { lcp: 0, cls: 0, gateReadyMs: 0, lcpElement: '' };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          window.__flightMetrics.lcp = entry.startTime;
          window.__flightMetrics.lcpElement = entry.element?.className || entry.element?.id || entry.element?.tagName || '';
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__flightMetrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      const gateObserver = new window.MutationObserver(() => {
        if (!document.querySelector('.gate-copy input:not(:disabled)')) return;
        gateObserver.disconnect();
        window.requestAnimationFrame(() => { window.__flightMetrics.gateReadyMs = performance.now(); });
      });
      gateObserver.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'View invitation', exact: true }).waitFor({ state: 'visible' });
    await page.locator('.gate-page img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    // Let the completed image/font paints reach the buffered LCP observer.
    await page.evaluate(() => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))));
    const metrics = await page.evaluate(() => {
      const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
      return { ...window.__flightMetrics, transferBytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0), resources: entries.map(entry => ({ name: new URL(entry.name).pathname, bytes: entry.transferSize, endMs: entry.responseEnd })) };
    });
    runs.push(metrics);
    if (run === 0) await page.screenshot({ path: fileURLToPath(new URL('mobile-gate.png', output)) });
    await context.close();
  }
} finally { await browser.close(); }
const median = values => [...values].sort((a, b) => a - b)[1];
const result = {
  profile: 'Chromium 390x844, cold cache, 1.6Mbps down / 750Kbps up, 150ms latency, 4x CPU slowdown',
  measuredAt: new Date().toISOString(),
  medianLcpMs: median(runs.map(run => run.lcp)),
  medianGateReadyMs: median(runs.map(run => run.gateReadyMs)),
  maximumCls: Math.max(...runs.map(run => run.cls)),
  maximumTransferBytes: Math.max(...runs.map(run => run.transferBytes)),
  targets: { lcpMs: 2500, cls: .1, transferBytes: 500 * 1024 },
  runs,
};
await writeFile(new URL('metrics.json', output), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, runs: undefined }, null, 2));
if (result.maximumTransferBytes > result.targets.transferBytes || result.maximumCls >= result.targets.cls || result.medianLcpMs >= result.targets.lcpMs) process.exitCode = 1;
