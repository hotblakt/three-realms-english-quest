import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { readFileSync } from 'node:fs';

const [base, output, renderer = 'canvas', mode = 'phone', duration = '0'] = process.argv.slice(2);
assert.ok(base && output && ['canvas', 'webgl'].includes(renderer));
assert.ok(['phone', 'tablet', 'desktop'].includes(mode));
assert.ok(Number.isFinite(Number(duration)) && Number(duration) >= 0);
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const { chromium } = playwright.default ?? playwright;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--disable-background-timer-throttling'],
});
const viewport = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 852, height: 393 },
  tablet: { width: 1180, height: 820 },
}[mode];
const network = 'local HTTP loopback, unthrottled';
const url = new URL('forest-preview/?renderer=' + renderer, base).href;
const failures = [];
const result = {
  url, renderer, mode, viewport, deviceScaleFactor: 1, browser: browser.version(),
  softwareWebGL: renderer === 'webgl', network, hardware: { cpu: cpus()[0].model, kernel: release(),
    logicalCpus: cpus().length, cpuQuota: readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim(),
    memoryLimitBytes: readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim() },
  cache: '3 isolated contexts, each with one first navigation and one reload; service workers blocked; server and OS caches uncontrolled',
  observations: [], failures,
};

async function setup(context) {
  await context.addInitScript(() => {
    const sample = window.qaSample = { bins: {}, stalls: [], frames: 0, focusLoss: 0 };
    const observer = new MutationObserver(() => {
      if (document.querySelector('#startup-state')?.textContent.includes('已繪製')) {
        sample.firstRender = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true });
    let previous;
    function frame(time) {
      if (sample.record && previous !== undefined) {
        const delta = time - previous;
        const bin = Math.round(delta * 10) / 10;
        sample.bins[bin] = (sample.bins[bin] ?? 0) + 1;
        sample.frames += 1;
        if (delta > 250) sample.stalls.push({ time, delta });
      }
      previous = time;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sample.focusLoss += 1;
    });
  });
}

const ready = page => page.waitForFunction(() =>
  window.qaSample.firstRender !== undefined &&
  document.querySelector('#forest-loading')?.hidden &&
  document.querySelector('#startup-state')?.textContent.includes('風靈地標已啟用'),
  undefined, { timeout: 25000 });

async function observe(page, cache) {
  await ready(page);
  return page.evaluate(cache => ({
    cache, firstRenderMs: window.qaSample.firstRender,
    startupLog: document.querySelector('#startup-log').value.trim().split('\n'),
    readyAndUnlockedMs: performance.now(),
    resources: performance.getEntriesByType('resource').map(entry => ({
      path: new URL(entry.name).pathname, transferBytes: entry.transferSize,
    })),
    heapIndicatorBytes: performance.memory?.usedJSHeapSize ?? null,
  }), cache);
}

try {
  for (let pair = 1; pair <= 3; pair += 1) {
    const context = await browser.newContext({
      viewport, isMobile: mode !== 'desktop', hasTouch: mode !== 'desktop',
      serviceWorkers: 'block',
    });
    try {
      await setup(context);
      const page = await context.newPage();
      page.on('pageerror', error => failures.push(error.message));
      await page.goto(url, { waitUntil: 'commit' });
      result.observations.push({ pair, ...await observe(page, 'cold') });
      await page.reload({ waitUntil: 'commit' });
      result.observations.push({ pair, ...await observe(page, 'warm reload') });
      if (pair === 3) {
        await page.evaluate(() => { window.qaSample.record = true; });
        const start = Date.now();
        let cycles = 0;
        do {
          for (const key of ['w', 's', 'a', 'd']) {
            await page.keyboard.down(key);
            await page.waitForTimeout(450);
            await page.keyboard.up(key);
            await page.waitForTimeout(250);
          }
          cycles += 1;
          await ready(page);
        } while (Date.now() - start < Number(duration) * 1000);
        const frames = await page.evaluate(() => {
          window.qaSample.record = false;
          return window.qaSample;
        });
        const rank = Math.ceil(frames.frames * 0.95);
        let cumulative = 0;
        const p95 = Object.entries(frames.bins).sort(([a], [b]) => Number(a) - Number(b))
          .find(([, count]) => (cumulative += count) >= rank)?.[0];
        result.stability = { elapsedMs: Date.now() - start, cycles, ...frames, p95Ms: Number(p95),
          finalHeapIndicatorBytes: await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null) };
        assert.equal(await page.locator('canvas').count(), 1);
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(failures, []);
} catch (error) {
  failures.push(error.stack);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
}
