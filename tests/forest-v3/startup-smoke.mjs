import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const [stable, production, output] = process.argv.slice(2);
assert.ok(stable && production && output);
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const { chromium } = playwright.default ?? playwright;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const checks = [
  { name: 'batch-b-404', path: '/forest-batch-b/forest-batch-b.webp', expected: '已繪製｜使用原竹林｜風靈地標已啟用' },
  { name: 'batch-c-404', path: '/forest-batch-c/forest-landmarks.webp', expected: '已繪製｜竹林生態已啟用｜使用原地標' },
  { name: 'necessary-run-404', path: '/eiku-run/eiku-north-run-256.webp', required: true },
  { name: 'necessary-run-stalled', path: '/eiku-run/eiku-north-run-256.webp', required: true, stall: true },
  { name: 'simulated-rotation-and-input' },
];
const report = { chromium: browser.version(), renderer: 'Canvas', viewport: '852×393, simulated mobile coarse input', checks: [] };
const ready = page => page.waitForFunction(() => document.querySelector('#startup-state')?.textContent.includes('風靈地標已啟用'));
const state = page => page.locator('#startup-state').textContent();
try {
  for (const [baseline, base] of [['PR #39', stable], ['PR #42', production]]) {
    for (const check of checks) {
      const context = await browser.newContext({ viewport: { width: 852, height: 393 },
        isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = await context.newPage();
        const matchesPath = url => url.pathname.endsWith(check.path);
        let stalled;
        let intercepted = 0;
        if (check.path) await page.route(matchesPath, route => {
          intercepted += 1;
          if (check.stall) {
            stalled = route;
            return;
          }
          return route.fulfill({ status: 404, body: 'QA fixture' });
        });
        await page.goto(new URL('forest-preview/?renderer=canvas', base).href);
        if (check.required) {
          await page.locator('#startup-retry').waitFor({ state: 'visible', timeout: 22000 });
          assert.ok(await page.locator('#forest-loading').isVisible());
          const failure = await state(page);
          await page.evaluate(() => localStorage.setItem('forest-v3-qa-marker', 'retained'));
          assert.ok(intercepted > 0, 'required resource was intercepted');
          if (check.stall) {
            assert.ok(failure.includes('啟動逾時'));
            await stalled.abort();
          }
          await page.unroute(matchesPath);
          await page.locator('#startup-retry').click();
          await ready(page);
          assert.equal(await page.evaluate(() => localStorage.getItem('forest-v3-qa-marker')), 'retained');
          report.checks.push({ baseline, case: check.name, failure, recovered: await state(page) });
        } else if (check.path) {
          await page.waitForFunction(() => document.querySelector('#startup-state')?.textContent.includes('已繪製'));
          const observed = await state(page);
          assert.ok(intercepted > 0, 'optional resource was intercepted');
          assert.ok(observed.includes(check.expected), JSON.stringify({
            observed, log: await page.locator('#startup-log').inputValue(),
          }));
          assert.ok(await page.locator('#forest-loading').isHidden());
          report.checks.push({ baseline, case: check.name, state: await state(page) });
        } else {
          await ready(page);
          assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
          await page.setViewportSize({ width: 393, height: 852 });
          await page.locator('#rotate-device').waitFor({ state: 'visible' });
          assert.equal(await page.locator('#stage').evaluate(stage => stage.inert), true);
          await page.setViewportSize({ width: 852, height: 393 });
          await page.locator('#rotate-device').waitFor({ state: 'hidden' });
          assert.equal(await page.locator('#stage').evaluate(stage => stage.inert), false);
          const stick = await page.locator('#stick').boundingBox();
          const cdp = await context.newCDPSession(page);
          const touchPoints = [{ x: stick.x + stick.width * .75, y: stick.y + stick.height / 2, id: 1 }];
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
          await page.waitForFunction(() => document.querySelector('#knob').style.transform !== '');
          const swing = await page.locator('[data-action="attack"]').boundingBox();
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
            ...touchPoints, { x: swing.x + swing.width / 2, y: swing.y + swing.height / 2, id: 2 },
          ] });
          assert.notEqual(await page.locator('#knob').evaluate(knob => knob.style.transform), '');
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForFunction(() => document.querySelector('#knob').style.transform === '');
          report.checks.push({ baseline, case: check.name, state: 'rotation gate, reduced-motion media query, simultaneous touch and release observed' });
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
