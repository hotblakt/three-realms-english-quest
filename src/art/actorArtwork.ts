import Phaser from 'phaser';

const size = 56;
const directions = ['south', 'west', 'east', 'north'] as const;
type Direction = typeof directions[number];
const sheet = 'eiku-wind';
const elderTexture = 'geno-wind';

function ink(ctx: CanvasRenderingContext2D, color: string, points: number[]): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) ctx.lineTo(points[index], points[index + 1]);
  ctx.closePath();
  ctx.fill();
}

function oval(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

const outline = '#131b2a';
const skin = '#e3a476';
const cloth = '#263344';
const indigo = '#43529a';

function paintEiku(ctx: CanvasRenderingContext2D, direction: Direction, frame: number): void {
  const walking = frame >= 2;
  const stride = walking ? [3, 0, -3, 0][frame - 2] : 0;
  const lift = frame % 2;
  const side = direction === 'east' || direction === 'west';
  const back = direction === 'north';
  oval(ctx, '#111d2c85', 28, 48, 16, 5);
  if (direction === 'west') {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  const hip = side ? 27 : 28;
  for (const sign of [-1, 1]) {
    const footX = hip + sign * (side ? 4 + stride : 5);
    const footY = side ? 46 : 45 + stride * sign;
    ink(ctx, outline, [hip + sign * 8, 34, footX + 4, footY, footX + 4, footY + 3, footX - 4, footY + 3, footX - 4, footY - 2, hip + sign, 36]);
    ink(ctx, '#41465b', [footX - 3, footY - 4, footX + 3, footY - 4, footX + 3, footY - 2, footX - 3, footY - 2]);
  }
  ctx.translate(0, -lift);
  const tail = frame % 2 ? 3 : 1;
  ink(ctx, '#30366e', [22, 17, 14, 19, 5, 18 + tail, 9, 23 + tail, 15, 24, 24, 21]);
  ink(ctx, '#5861a3', [18, 20, 10, 22 + tail, 4, 23 + tail, 7, 26 + tail, 19, 24]);
  // The bronze guard and wrapped hilt stay visible on the shoulder.
  ink(ctx, outline, [33, 35, 39, 14, 44, 11, 46, 14, 40, 36]);
  ink(ctx, '#a97049', [37, 19, 46, 21, 45, 24, 36, 22]);
  ink(ctx, '#eee1b2', [41, 14, 44, 13, 44, 17, 40, 19]);
  ink(ctx, outline, [17, 25, 37, 25, 43, 37, 38, 41, 32, 37, 20, 41, 15, 38, 12, 35]);
  ink(ctx, cloth, [18, 28, 35, 27, 39, 36, 32, 38, 20, 38, 16, 35]);
  ink(ctx, '#526074', [17, 28, 29, 29, 24, 35, 18, 36, 14, 34]);
  ink(ctx, '#286963', [23, 31, 27, 34, 34, 30, 30, 36, 20, 39, 20, 36]);
  ink(ctx, '#72c6b0', [21, 36, 25, 34, 25, 36, 23, 37]);
  ink(ctx, '#b67854', [15, 35, 19, 35, 19, 38, 16, 39]);
  if (!back) {
    ink(ctx, outline, [17, 13, 34, 11, 40, 16, 39, 25, 33, 30, 23, 30, 16, 24]);
    ink(ctx, skin, side ? [20, 15, 36, 15, 38, 20, 41, 23, 37, 24, 34, 28, 25, 27, 19, 22] :
      [18, 15, 37, 15, 38, 22, 32, 28, 25, 28, 18, 23]);
    ink(ctx, '#f4c38d', [25, 19, 37, 18, 36, 23, 32, 26, 28, 26]);
    for (const x of side ? [34] : [23, 32]) {
      ink(ctx, outline, [x - 2, 20, x + 3, 20, x + 2, 23, x - 1, 23]);
      ink(ctx, '#ffcf6d', [x, 21, x + 2, 21, x + 1, 23, x, 23]);
    }
  }
  ink(ctx, outline, [15, 19, 13, 12, 17, 12, 16, 7, 22, 9, 24, 4, 29, 7, 34, 4, 35, 9, 42, 12, 40, 20,
    35, back ? 28 : 16, 30, back ? 29 : 19, 27, 15, 22, back ? 27 : 18, 21, 15, 17, 22]);
  ink(ctx, '#37445e', [16, 13, 23, 11, 25, 7, 28, 10, 33, 7, 33, 10, 39, 13, 34, 13, 30, 15, 25, 12, 20, 15]);
  ink(ctx, indigo, [15, 14, 23, 15, 34, 13, 41, 14, 40, 18, 31, 17, 23, 19, 16, 18]);
  if (!back) {
    const x = side ? 34 : 28;
    ink(ctx, '#dae1e2', [x - 3, 15, x + 4, 14, x + 4, 17, x - 3, 18]);
    ink(ctx, '#507d88', [x - 1, 16, x + 2, 15, x + 3, 16, x, 17]);
  }
}

function paintGeno(ctx: CanvasRenderingContext2D): void {
  oval(ctx, '#111d2c85', 28, 48, 17, 5);
  ink(ctx, outline, [18, 26, 35, 23, 42, 35, 38, 39, 39, 47, 31, 49, 26, 47, 17, 49, 13, 45, 15, 36, 10, 35]);
  ink(ctx, '#293d62', [18, 27, 34, 26, 39, 34, 35, 39, 37, 46, 18, 46, 19, 36, 13, 34]);
  ink(ctx, '#586c8d', [19, 28, 24, 26, 32, 27, 27, 38, 21, 41, 22, 34]);
  ink(ctx, '#c1a16a', [20, 39, 35, 38, 36, 40, 20, 41]);
  ink(ctx, '#ab7b54', [40, 25, 44, 22, 46, 25, 43, 48, 40, 48, 42, 26]);
  ink(ctx, '#ebbb7d', [41, 25, 44, 23, 44, 28, 42, 30]);
  ink(ctx, outline, [16, 15, 19, 8, 27, 5, 35, 8, 39, 16, 36, 24, 31, 28, 20, 24]);
  ink(ctx, '#9ba8b6', [17, 15, 22, 9, 30, 7, 36, 11, 38, 16, 34, 18, 19, 20]);
  ink(ctx, '#e3e7d9', [19, 14, 24, 10, 31, 9, 34, 11, 27, 12, 24, 16]);
  ink(ctx, skin, [20, 16, 33, 14, 35, 19, 32, 25, 24, 25, 20, 22]);
  ink(ctx, '#e2e3d4', [19, 19, 23, 22, 26, 21, 30, 22, 35, 19, 33, 29, 27, 34, 22, 28]);
  ink(ctx, '#364153', [21, 18, 25, 18, 24, 20, 21, 20]);
  ink(ctx, '#364153', [29, 18, 33, 17, 33, 19, 30, 20]);
}

export function makeActorTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(sheet)) return;
  const texture = scene.textures.createCanvas(sheet, size * 6, size * directions.length)!;
  const ctx = texture.context;
  directions.forEach((direction, row) => {
    for (let frame = 0; frame < 6; frame++) {
      ctx.save();
      ctx.translate(frame * size, row * size);
      paintEiku(ctx, direction, frame);
      ctx.restore();
      texture.add(`${direction}-${frame}`, 0, frame * size, row * size, size, size);
    }
  });
  texture.refresh();
  const elder = scene.textures.createCanvas(elderTexture, size, size)!;
  paintGeno(elder.context);
  elder.refresh();
}

export function createEiku(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Sprite {
  makeActorTextures(scene);
  directions.forEach(direction => {
    for (const [motion, frames, frameRate] of [
      ['idle', [0, 1], 2], ['walk', [2, 3, 4, 5], 10], ['dodge', [2, 4], 18],
    ] as const) {
      const key = `eiku-${direction}-${motion}`;
      if (!scene.anims.exists(key)) {
        scene.anims.create({ key, frames: frames.map(frame => ({ key: sheet, frame: `${direction}-${frame}` })), frameRate, repeat: -1 });
      }
    }
  });
  return scene.add.sprite(x, y, sheet, 'south-0').setOrigin(.5, .84).setDepth(y);
}

export function animateEiku(sprite: Phaser.GameObjects.Sprite, facing: Phaser.Math.Vector2, motion: 'idle' | 'walk' | 'dodge'): void {
  const direction = facing.x ? (facing.x > 0 ? 'east' : 'west') : (facing.y > 0 ? 'south' : 'north');
  sprite.play(`eiku-${direction}-${motion}`, true);
}

export function createGeno(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  makeActorTextures(scene);
  return scene.add.image(x, y, elderTexture).setOrigin(.5, .84).setDepth(y);
}
