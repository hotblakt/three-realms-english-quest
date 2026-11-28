import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [stable, candidate, output, renderer = 'canvas'] = process.argv.slice(2);
assert.ok(stable && candidate && output && ['canvas', 'webgl'].includes(renderer));
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const { chromium } = playwright.default ?? playwright;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader'],
});
const views = [
  ['entrance', 477, 766], ['canopy', 502, 638], ['bridge-water', 675, 451],
  ['west-treasure', 197, 440], ['shrine-front', 920, 137], ['shrine-behind', 920, 101],
  ['east-return', 1085, 260],
];
const viewport = { width: 852, height: 393 };
const summary = { browser: browser.version(), renderer, viewport, cases: {} };
await mkdir(output, { recursive: true });

async function inspect(base, label) {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.route('**/forest-batch-b-preview/boot.ts*', async route => {
      const response = await route.fetch();
      const source = await response.text();
      const instrumented = source.replace(/postBoot:\s*\(?game\)?\s*=>\s*\{/,
        '$& window.qaGame = game; window.qaScene = () => game.scene.getScene("misty-forest");');
      assert.notEqual(instrumented, source, 'QA hook must match the Vite development boot module');
      await route.fulfill({ response, body: instrumented });
    });
    await page.goto(new URL('forest-preview/?renderer=' + renderer, base).href);
    await page.waitForFunction(() => document.querySelector('#startup-state')?.textContent.includes('風靈地標已啟用'));
    const canvas = page.locator('#game canvas');
    const cdp = await context.newCDPSession(page);

    async function place(x, y, direction = true) {
      await page.evaluate(([x, y, direction]) => {
        const scene = window.qaScene();
        scene.player.body.reset(x, y);
        scene.player.syncView();
        if (direction) scene.player.facing.set(0, 1);
        scene.cameras.main.stopFollow().centerOn(x, y - 18);
      }, [x, y, direction]);
      await page.waitForFunction(([x, y]) => window.qaScene().candidate.x === x && window.qaScene().candidate.y === y, [x, y]);
    }

    async function decodeCompare(a, b, tolerance = 0) {
      return page.evaluate(async ([a, b, tolerance]) => {
        async function rgba(image) {
          const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + image)).blob());
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const context = canvas.getContext('2d');
          context.drawImage(bitmap, 0, 0);
          const { width, height } = bitmap;
          bitmap.close();
          return { width, height, data: context.getImageData(0, 0, width, height).data };
        }
        const [before, after] = await Promise.all([rgba(a), rgba(b)]);
        if (before.width !== after.width || before.height !== after.height) throw new Error('Screenshot dimensions differ');
        let changed = 0;
        let maxChannelDelta = 0;
        for (let i = 0; i < before.data.length; i += 4) {
          const delta = Math.max(...[0, 1, 2, 3].map(channel => Math.abs(before.data[i + channel] - after.data[i + channel])));
          if (delta > tolerance) changed += 1;
          maxChannelDelta = Math.max(maxChannelDelta, delta);
        }
        return { changed, maxChannelDelta, pixels: before.width * before.height };
      }, [a.toString('base64'), b.toString('base64'), tolerance]);
    }

    const pixels = {};
    const shots = {};
    for (const [name, x, y] of views) {
      await place(x, y);
      if (name.startsWith('shrine')) {
        await page.waitForFunction(expected => Math.abs(window.qaScene().children.list
          .find(image => image.frame?.name === 'shrine-body').alpha - expected) < .001,
        name === 'shrine-behind' ? .28 : 1);
      }
      await page.evaluate(() => {
        const scene = window.qaScene();
        scene.scene.pause();
        scene.runs['south-idle'].draw(scene.candidate, 256, 0, 44 * 207 / 100);
      });
      try {
        const visible = await canvas.screenshot();
        await writeFile(join(output, label + '-' + name + '.png'), visible);
        shots[name] = visible;
        if (name === 'entrance' || name === 'shrine-behind') {
          await page.evaluate(() => window.qaScene().candidate.setVisible(false));
          pixels[name] = await decodeCompare(visible, await canvas.screenshot(), 7);
          assert.ok(pixels[name].changed > 500, name + ': avatar visibility');
        }
      } finally {
        await page.evaluate(() => {
          const scene = window.qaScene();
          scene.candidate.setVisible(true);
          scene.scene.resume();
        });
      }
    }

    if (label === 'candidate') {
      for (const [name, before] of Object.entries(baselineShots)) {
        pixels[name + '-diff'] = await decodeCompare(before, shots[name]);
      }
    }

    const inputMs = [];
    for (const [key, direction] of [['w', 'north'], ['s', 'south'], ['d', 'east'], ['a', 'west']]) {
      for (let run = 0; run < 5; run += 1) {
        await place(477, 766);
        await page.evaluate(([key, direction]) => {
          window.qaResponse = null;
          document.addEventListener('keydown', function start(event) {
            if (event.key !== key) return;
            document.removeEventListener('keydown', start, true);
            const time = performance.now();
            const texture = 'eiku-' + direction + '-run-256';
            const rendered = () => {
              if (window.qaScene().candidate.texture.key !== texture) return;
              window.qaResponse = performance.now() - time;
              window.qaGame.events.off('postrender', rendered);
            };
            window.qaGame.events.on('postrender', rendered);
          }, true);
        }, [key, direction]);
        await page.keyboard.down(key);
        try {
          await page.waitForFunction(() => window.qaResponse !== null);
          inputMs.push({ direction, ms: await page.evaluate(() => window.qaResponse) });
        } finally {
          await page.keyboard.up(key);
        }
        await page.waitForFunction(direction => window.qaScene().candidate.texture.key
          === 'eiku-' + direction + '-idle-256', direction);
      }
    }
    const sorted = inputMs.map(sample => sample.ms).sort((a, b) => a - b);
    const p95InputMs = sorted[Math.ceil(sorted.length * .95) - 1];

    await place(197, 440);
    await page.locator('[data-action="interact"]').tap();
    await page.waitForFunction(() => window.qaScene().opened);
    const visits = [];
    for (let visit = 1; visit <= 3; visit += 1) {
      await place(920, 101);
      await page.waitForFunction(() => window.qaScene().candidate.visible);
      if (visit === 1 && process.env.FOREST_IDLE_30S === '1') {
        await page.waitForTimeout(30000);
        await page.evaluate(() => window.qaScene().scene.pause());
        const visible = await canvas.screenshot();
        await page.evaluate(() => window.qaScene().candidate.setVisible(false));
        const comparison = await decodeCompare(visible, await canvas.screenshot(), 7);
        assert.ok(comparison.changed > 500, '30-second shrine idle avatar visibility');
        pixels.shrineIdle30s = comparison;
        await page.evaluate(() => {
          window.qaScene().candidate.setVisible(true);
          window.qaScene().scene.resume();
        });
      }
      await place(1085, 260);
      await page.locator('[data-action="interact"]').tap();
      await page.waitForFunction(() => window.qaScene().candidate.x === 477 && window.qaScene().candidate.y === 766);
      await page.waitForTimeout(process.env.FOREST_VISIT_SETTLE_MS ? Number(process.env.FOREST_VISIT_SETTLE_MS) : 1000);
      const textures = await page.evaluate(() => {
        const manager = window.qaGame.textures;
        return manager.getTextureKeys().flatMap(key =>
          manager.get(key).source.map(({ width, height }) => ({ key, width, height, rgbaBytes: width * height * 4 })));
      });
      const heap = await cdp.send('Runtime.getHeapUsage');
      visits.push({ visit, heap, textureCount: textures.length,
        rgbaBytes: textures.reduce((total, item) => total + item.rgbaBytes, 0), textures });
    }
    summary.cases[label] = { pixels, inputMs, p95InputMs, visits };
    return shots;
  } finally {
    await context.close();
  }
}

let baselineShots;
try {
  baselineShots = await inspect(stable, 'stable');
  await inspect(candidate, 'candidate');
  const changed = Object.entries(summary.cases.candidate.pixels)
    .filter(([name, value]) => name.endsWith('-diff') && value.changed !== 0);
  if (process.env.FOREST_APPROVED_VISUAL_CHANGES !== '1') assert.deepEqual(changed, []);
} finally {
  await browser.close();
  await writeFile(join(output, 'visual.json'), JSON.stringify(summary, null, 2) + '\n');
}
