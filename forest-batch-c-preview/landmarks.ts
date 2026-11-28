import type Phaser from 'phaser';
import provenance from '../docs/forest-batch-c-provenance.json';
import { prepareVerifiedAtlas } from '../forest-batch-b-preview/prepareAtlas';
import { registerOptionalAtlas } from '../forest-batch-b-preview/atlas';
import type { PrepareForestDecoration } from '../forest-batch-b-preview/boot';
import { spirit } from '../forest-preview/layout';
import { addLanternLight, addSoftShadow } from '../src/art/villageAtmosphere';

const atlas = 'forest-batch-c';
type Module = keyof typeof provenance.frames;
const shrine = { x: spirit.x, y: spirit.y - 6 };
const lanterns = [
  { frame: 'lantern-a', x: 564, y: 483, width: 31, glow: 26 },
  { frame: 'lantern-b', x: 778, y: 463, width: 29, glow: 23 },
  { frame: 'lantern-c', x: 856, y: 191, width: 30, glow: 25 },
  { frame: 'lantern-a', x: 966, y: 130, width: 27, glow: 23 },
] as const;

function image(scene: Phaser.Scene, frame: Module, x: number, y: number, width: number) {
  const art = scene.add.image(x, y, atlas, frame);
  return art.setScale(width / art.width).setTint(0xe0dfbd);
}

function drawLandmarks(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
  const lights: Phaser.GameObjects.Image[] = [];
  addSoftShadow(scene, shrine.x, shrine.y - 2, 112, 29, .81);
  image(scene, 'shrine-body', shrine.x, shrine.y, 119).setOrigin(.5, .98).setDepth(shrine.y);

  for (const { frame, x, y, width, glow } of lanterns) {
    addSoftShadow(scene, x, y - 1, width * 1.3, 15, .78);
    image(scene, frame, x, y, width).setOrigin(.5, .98).setDepth(y);
    lights.push(...addLanternLight(scene, x, y - glow));
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ring = image(scene, 'wind-circle', spirit.x, spirit.y + 13, 67).setDepth(-1.1).setTint(0xb6ebda).setAlpha(.31);
  const arc = image(scene, 'wind-arc', spirit.x - 39, spirit.y + 19, 56).setDepth(-1.08).setTint(0xa2e1d0).setAlpha(.28);
  const vortex = image(scene, 'wind-vortex', spirit.x + 42, spirit.y + 16, 51).setDepth(-1.07).setTint(0xa9d7d0).setAlpha(.23);
  const butterfly = image(scene, 'wind-butterfly', spirit.x + 21, spirit.y + 1, 18)
    .setDepth(spirit.y - 1).setTint(0xb9e7cf).setAlpha(.61);
  if (!reduce) {
    scene.tweens.add({ targets: [ring, arc, vortex], alpha: .12, duration: 2750, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: butterfly, x: butterfly.x + 13, y: butterfly.y - 11,
      alpha: .32, duration: 2350, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  return [...lights, ring, arc, vortex, butterfly];
}

export const prepareLandmarks: PrepareForestDecoration = async (signal, note) => {
  const prefix = (message: string) => note(`Batch C｜${message}`, false);
  const atlasImage = await prepareVerifiedAtlas('forest-batch-c', provenance.meta, signal, prefix);
  return scene => {
    const registered = registerOptionalAtlas(
      () => { scene.textures.addAtlas(atlas, atlasImage, { frames: provenance.frames }); },
      () => scene.textures.exists(atlas) && Object.keys(provenance.frames).every(frame => scene.textures.get(atlas).has(frame)),
      () => { if (scene.textures.exists(atlas)) scene.textures.remove(atlas); },
    );
    if (registered.ok) {
      prefix('地標紋理已註冊');
      return drawLandmarks;
    }
    prefix(`沿用原地標｜紋理註冊失敗：${registered.reason}`);
  };
};
