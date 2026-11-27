import type Phaser from 'phaser';
import { bankSamples, bridge, creekColliders, height, streamCenter } from '../layout';
import { falls, landmarks, place } from './placement';
import { placeCreekArt, shoreline, upstreamFall } from './creekArt';

type Block = (x: number, y: number, width: number, height: number) => void;

export function drawCreek(scene: Phaser.Scene, block: Block): void {
  const samples = bankSamples();
  const left = Math.floor(Math.min(...samples.map(p => p.x - p.west))) - 24;
  const right = Math.ceil(Math.max(...samples.map(p => p.x + p.east))) + 24;
  const bed = scene.textures.createCanvas('forest-stream-bed', Math.ceil((right - left) * .75), Math.ceil(height * .75))!;
  const ctx = bed.context;
  ctx.scale(.75, .75);

  const channel = (inset: number) => {
    const path = new Path2D();
    samples.forEach(({ x, y, west }, i) => {
      const edge = x - west + inset - left;
      if (i === 0) path.moveTo(edge, y);
      else path.lineTo(edge, y);
    });
    for (let i = samples.length - 1; i >= 0; i--) {
      const { x, y, east } = samples[i];
      path.lineTo(x + east - inset - left, y);
    }
    path.closePath();
    return path;
  };
  // Draw staggered contours with softened edges to meet the irregular ground.
  for (const [inset, tone, blur] of [
    [-14, '#1732228b', 7], [-7, '#827d56bf', 5], [-1, '#283b35dc', 3.5], [4, '#366963', 3],
  ] as const) {
    ctx.fillStyle = tone;
    ctx.filter = `blur(${blur}px)`;
    ctx.fill(channel(inset));
  }
  ctx.filter = 'none';
  const premium = scene.textures.exists('batch-water');
  const water = scene.textures.get(premium ? 'batch-water' : 'water').getSourceImage() as HTMLImageElement;
  const layer = document.createElement('canvas');
  layer.width = bed.width;
  layer.height = bed.height;
  const waterCtx = layer.getContext('2d')!;
  const pattern = waterCtx.createPattern(water, 'repeat');
  if (pattern) {
    if (premium && typeof pattern.setTransform === 'function') {
      pattern.setTransform(new DOMMatrix().rotate(-14).scale(.73));
    }
    waterCtx.scale(.75, .75);
    waterCtx.fillStyle = pattern;
    waterCtx.fillRect(0, 0, right - left, height);
    waterCtx.globalCompositeOperation = 'destination-in';
    waterCtx.fillStyle = '#fff';
    // Feather only the alpha channel, leaving painted detail sharp inside the water.
    waterCtx.filter = 'blur(5px)';
    waterCtx.fill(channel(6));
    ctx.save();
    ctx.resetTransform();
    ctx.globalAlpha = premium ? .88 : .72;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
  bed.refresh();
  scene.add.image(left, 0, bed.key).setOrigin(0).setDisplaySize(right - left, height).setDepth(-5);

  // Use the original collider centerline and bridge opening. The visual bank is independent.
  for (const { x, y, width, height } of creekColliders()) {
    block(x, y, width, height);
  }
  for (const [i, y] of [72, 117, 186, 232, 294, 355, 570, 624, 694, 748, 818, 865].entries()) {
    const x = streamCenter(y) + (i % 2 ? 1 : -1) * (40 + i % 3 * 5);
    place(scene, { key: i % 3 ? 'rock-small' : 'underbrush', x, y, layer: 'water',
      scale: .23 + i % 4 * .063, tint: 0xa6b78e, alpha: .86, flip: Boolean(i % 2) });
  }
  shoreline.forEach(item => placeCreekArt(scene, item, -3.8));
  placeCreekArt(scene, upstreamFall.face, -3.65);
  place(scene, landmarks.bridge);
  flow(scene);
}

function flow(scene: Phaser.Scene): void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(any-pointer: coarse)').matches;
  const art = scene.make.graphics({ x: 0, y: 0 }, false);
  art.lineStyle(1, 0xcde5d3, .65).lineBetween(7, 1, 1, 19)
    .lineStyle(1, 0xaed9c7, .35).lineBetween(9, 5, 5, 15);
  art.generateTexture('forest-flow', 10, 20);
  art.destroy();
  const stride = touch ? 87 : 55;
  for (let y = 16; y < height - 35; y += stride) {
    if (Math.abs(y - bridge.y) < 107 || Math.abs(y - upstreamFall.face.y) < 48) continue;
    const offset = (y % 31) - 15;
    const x = streamCenter(y) + offset;
    const line = scene.add.image(x, y, 'forest-flow').setDepth(-4).setAlpha(.34).setAngle(5);
    if (!reduce) {
      scene.tweens.add({ targets: line, x: streamCenter(y + 34) + offset, y: y + 34,
        alpha: 0, delay: y % 460, duration: 2200 + y % 670, repeat: -1, repeatDelay: 250 });
    }
  }
  const premium = scene.textures.exists(upstreamFall.face.key);
  const sprays = premium
    ? [...falls, { lip: upstreamFall.spray, width: upstreamFall.spray.width,
        length: upstreamFall.spray.length, face: undefined }]
    : falls;
  for (const { lip, width, length, face } of sprays) {
    if (face) place(scene, face);
    const droplets = touch ? 2 : 3;
    for (let i = 0; i < droplets; i++) {
      const streak = scene.add.image(lip.x + (i / (droplets - 1) - .5) * width, lip.y, 'forest-flow')
        .setDepth(-2.9).setScale(.7).setAlpha(.19);
      if (!reduce) scene.tweens.add({
        targets: streak, x: streak.x - length * .42, y: lip.y + length, alpha: 0,
        delay: i * 130, duration: 610 + i * 70, repeat: -1,
      });
    }
  }
  if (premium) {
    const foam = scene.add.ellipse(upstreamFall.pool.x, upstreamFall.pool.y, 32, 9, 0xa4ded6, .16)
      .setDepth(-3.61).setAngle(-11);
    if (!reduce) scene.tweens.add({ targets: foam, alpha: .03, scaleX: 1.24, scaleY: 1.18,
      duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}
