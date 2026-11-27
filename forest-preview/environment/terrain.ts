import type Phaser from 'phaser';
import { height, routes, width } from '../layout';
import { clearings, place } from './placement';

const stones = [
  [477, 759, .53, -24], [502, 653, .59, -16], [546, 552, .61, 1],
  [593, 488, .53, 5], [606, 464, .39, -22], [748, 444, .42, -24],
  [789, 406, .52, -7], [839, 321, .55, -4], [878, 226, .61, -9],
  [914, 155, .45, 0], [405, 556, .44, 46], [286, 500, .46, 45],
  [222, 439, .42, 48], [1008, 287, .48, 10],
] as const;

const moss = [
  [170, 620, 148], [440, 335, 147], [124, 312, 215], [745, 182, 120],
  [1040, 555, 230], [1183, 385, 139], [698, 809, 155], [1070, 800, 222],
] as const;

export function drawTerrain(scene: Phaser.Scene): void {
  scene.add.tileSprite(0, 0, width, height, 'ground').setOrigin(0).setDepth(-10).setTint(0x9aaa92);
  const patina = scene.textures.createCanvas('forest-ground-patina', width / 2, height / 2)!;
  const ctx = patina.context;
  ctx.scale(.5, .5);
  for (const [x, y, r] of moss) {
    const wash = ctx.createRadialGradient(x, y, 2, x, y, r);
    wash.addColorStop(0, 'rgba(12,36,41,.40)');
    wash.addColorStop(.45, 'rgba(27,54,48,.22)');
    wash.addColorStop(1, 'rgba(32,60,49,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(x-r, y-r, 2*r, 2*r);
  }
  for (const { x, y, radius } of clearings) {
    const wash = ctx.createRadialGradient(x, y, 5, x, y, radius);
    wash.addColorStop(0, 'rgba(207,177,96,.24)');
    wash.addColorStop(1, 'rgba(207,177,96,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(x-radius, y-radius, radius*2, radius*2);
  }
  for (const [index, route] of routes.entries()) {
    const path = new Path2D();
    path.moveTo(route[0][0], route[0][1]);
    for (let i = 1; i < route.length - 1; i++) {
      const [x, y] = route[i];
      const [nx, ny] = route[i + 1];
      path.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    const [x, y] = route[route.length - 1];
    path.lineTo(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const [offset, color] of [[0, '#18352d52'], [14, '#766d4c49'], [27, '#b39c6550']] as const) {
      ctx.lineWidth = (index === 0 ? 87 : 59) - offset;
      ctx.strokeStyle = color;
      ctx.stroke(path);
    }
  }
  // Bake a few irregular leaf patches into the terrain, with no extra per-leaf sprites.
  let seed = 1231;
  const random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32);
  for (const { x, y, radius } of clearings) {
    for (let i = 0; i < 34; i++) {
      const angle = random() * Math.PI * 2;
      const r = radius * (.26 + random() * .64);
      ctx.save();
      ctx.translate(x + Math.cos(angle) * r, y + Math.sin(angle) * r * .66);
      ctx.rotate(angle + random());
      ctx.fillStyle = ['#a67f4d80', '#bb9e5760', '#56623499'][i % 3];
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.5 + random()*4, .75 + random() * 1.2, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
  }
  patina.refresh();
  scene.add.image(0, 0, patina.key).setOrigin(0).setDisplaySize(width, height).setDepth(-9);
  for (const [i, [x,y,scale,angle]] of stones.entries()) {
    place(scene, { key: 'stone', x, y, scale, angle, flip: i === 4 || i === 10,
      layer: 'ground', alpha: .88, tint: i < 10 ? 0xdacfad : 0xb5ba95 });
  }
}
