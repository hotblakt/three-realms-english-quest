// Run against the Vite development server with Playwright installed outside the game.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const base = process.argv[2] ?? 'http://localhost:5173';
const renderer = process.argv[3] ?? 'canvas';
const output = process.env.FOREST_PIXEL_OUTPUT;
const page = await browser.newPage({ viewport: { width: 852, height: 393 }, isMobile: true, hasTouch: true,
  reducedMotion: 'reduce' });

try {
  // Expose the scene only in this test tab. No production debug global is needed.
  await page.route('**/forest-batch-b-preview/boot.ts*', async route => {
    const response = await route.fetch();
    const original = await response.text();
    const instrumented = original.replace(/postBoot:\s*\(?game\)?\s*=>\s*\{/,
      '$& window.__forestRenderTest = game;');
    assert.notEqual(instrumented, original);
    await route.fulfill({ response, body: instrumented });
  });
  await page.goto(`${base}/forest-batch-c-preview/?renderer=${renderer}`);
  await page.waitForFunction(() => document.querySelector('#startup-state')?.textContent.includes('風靈地標已啟用'));
  const canvas = page.locator('#game canvas');

  async function checkFrame(label, x, y, key, direction) {
    await page.evaluate(() => {
      const scene = window.__forestRenderTest.scene.getScene('misty-forest');
      scene.player.body.reset(477, 766);
      scene.player.syncView();
    });
    await page.keyboard.down(key);
    await page.waitForFunction(d => window.__forestRenderTest.scene.getScene('misty-forest').candidate.texture.key
      === `eiku-${d}-run-256`, direction);
    await page.keyboard.up(key);
    await page.waitForFunction(d => window.__forestRenderTest.scene.getScene('misty-forest').candidate.texture.key
      === `eiku-${d}-idle-256`, direction);
    await page.evaluate(([x, y]) => {
      const scene = window.__forestRenderTest.scene.getScene('misty-forest');
      scene.player.body.reset(x, y);
      scene.player.syncView();
      scene.cameras.main.stopFollow().centerOn(x, y - 18);
    }, [x, y]);
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__forestRenderTest.scene.getScene('misty-forest').scene.pause());
    const visible = await canvas.screenshot();
    await page.evaluate(() => window.__forestRenderTest.scene.getScene('misty-forest').candidate.setVisible(false));
    const hidden = await canvas.screenshot();
    await page.evaluate(() => {
      const scene = window.__forestRenderTest.scene.getScene('misty-forest');
      scene.candidate.setVisible(true);
      scene.scene.resume();
    });
    const changed = await page.evaluate(async images => {
      const decode = async png => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
        bitmap.close();
        return pixels;
      };
      const [a, b] = await Promise.all(images.map(decode));
      let count = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i+1] - b[i+1]), Math.abs(a[i+2] - b[i+2])) > 7) count++;
      }
      return count;
    }, [visible, hidden].map(image => image.toString('base64')));
    if (output) await writeFile(`${output}/${renderer}-${label}.png`, visible);
    assert.ok(changed > 500, `${renderer} ${label}: only ${changed} avatar pixels above threshold`);
    console.log(renderer, label, changed);
  }

  await checkFrame('entrance-east', 477, 766, 'd', 'east');
  await checkFrame('entrance-west', 477, 766, 'a', 'west');
  await checkFrame('bridge-north', 675, 451, 'w', 'north');
  await checkFrame('shrine-front-south', 920, 137, 's', 'south');
  await checkFrame('shrine-behind-south', 920, 101, 's', 'south');
  await checkFrame('shrine-behind-west', 920, 75, 'a', 'west');
} finally {
  await browser.close();
}
