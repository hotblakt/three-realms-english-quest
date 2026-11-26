import type Phaser from 'phaser';
import { clipCalibration } from './directionalScale';
import { calibratedSize, clearScaleTransition } from './scalePanel';

interface TextureVariant {
  url: string;
  bytes: number;
  width: number;
  height: number;
}

interface ClipManifest {
  id: string;
  frameCount: number;
  fps: number;
  diagnostic?: boolean;
  oneShot?: boolean;
  referenceSpeed: number;
  standingHeightInFrame: number;
  origin: number[];
  textures: Record<string, TextureVariant>;
}

export class AnimationClip {
  private phase = 0;
  private readonly requested = new Set<number>();

  constructor(readonly manifest: ClipManifest, private readonly directory: string) {}

  private key(size: number): string {
    return `${this.manifest.id}-${size}`;
  }

  ensure(scene: Phaser.Scene, size: number): boolean {
    const key = this.key(size);
    if (scene.textures.exists(key)) return true;
    if (this.requested.has(size)) return false;
    const variant = this.manifest.textures[String(size)];
    if (!variant) return false;
    this.requested.add(size);
    scene.load.spritesheet(key, `${import.meta.env.BASE_URL}${this.directory}/${variant.url}`, {
      frameWidth: size, frameHeight: size, endFrame: this.manifest.frameCount - 1,
    });
    if (!scene.load.isLoading()) scene.load.start();
    return false;
  }

  reset(frame = 0): void { this.phase = frame; }

  get finished(): boolean {
    return Boolean(this.manifest.diagnostic || this.manifest.oneShot) && this.phase >= this.manifest.frameCount;
  }

  advance(seconds: number, speed: number): number {
    this.phase += seconds * speed * this.manifest.fps;
    if (!this.manifest.diagnostic && !this.manifest.oneShot) this.phase %= this.manifest.frameCount;
    return Math.min(Math.floor(this.phase), this.manifest.frameCount - 1);
  }

  draw(image: Phaser.GameObjects.Image, size: number, frame: number, standHeight: number): void {
    const texture = this.key(size);
    if (image.texture.key !== texture) image.setTexture(texture, frame);
    else if (Number(image.frame.name) !== frame) image.setFrame(frame);
    const [x, y] = this.manifest.origin;
    const nominal = standHeight / this.manifest.standingHeightInFrame;
    const art = clipCalibration(this.manifest.id);
    if (!art) clearScaleTransition(image);
    const displaySize = art ? calibratedSize(image, nominal, art.direction, art.action) : nominal;
    image.setOrigin(x, y).setDisplaySize(displaySize, displaySize);
  }
}
