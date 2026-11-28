// Run with Playwright outside the game dependencies, against the production preview.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const url = process.argv[2] ?? 'http://localhost:4173/three-realms-english-quest/mission-control/';
try {
  for (const [width, height] of [[390, 844], [320, 667], [820, 1180], [1180, 820]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true, value: { writeText: async () => { throw Error('simulated denied permission'); } },
      });
    });
    await context.route('**/mission-control/github-status.json', route => route.fulfill({
      json: { repository: 'hotblakt/three-realms-english-quest', observedAt: '2020-01-01T00:00:00Z',
        coverage: 'partial', privateNote: 'PRIVATE-TEST-CONTENT',
        stablePages: { id: 34, status: 'success', url: 'https://example.invalid/private' } },
    }));
    const page = await context.newPage();
    await page.goto(url);
    const action = page.locator('#next h3');
    await action.waitFor();
    assert.equal(await action.count(), 1);
    assert.match(await action.innerText(), /交接森林 3\.0 世界設計/);
    await page.getByText('快照已超過 24 小時').waitFor();
    assert.doesNotMatch(await page.locator('body').innerText(), /PRIVATE-TEST-CONTENT/);
    assert.equal(await page.locator('a[href*="example.invalid"]').count(), 0);
    await page.locator('#next summary').tap();
    await page.getByRole('button', { name: '複製提示' }).tap();
    await page.getByText(/已選取，請使用裝置/).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.ok((await page.getByRole('button', { name: '複製提示' }).boundingBox()).height >= 44);
    console.log(`${width}×${height} layout, stale snapshot, sanitized links, and copy fallback passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
