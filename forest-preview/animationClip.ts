import type Phaser from 'phaser';

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
  referenceSpeed: number;
  standingHeightInFrame: number;
  origin: number[];
  textures: Record<string, TextureVariant>;
}

export class AnimationClip {
  private phase = 0;

  constructor(readonly manifest: ClipManifest, private readonly directory: string) {}

  private key(size: number): string {
    return `${this.manifest.id}-${size}`;
  }

  preload(scene: Phaser.Scene): void {
    for (const [size, variant] of Object.entries(this.manifest.textures)) {
      scene.load.spritesheet(this.key(Number(size)), `${import.meta.env.BASE_URL}${this.directory}/${variant.url}`, {
        frameWidth: Number(size), frameHeight: Number(size), endFrame: this.manifest.frameCount - 1,
      });
    }
  }

  reset(frame = 0): void { this.phase = frame; }

  advance(seconds: number, speed: number): number {
    this.phase = (this.phase + seconds * speed * this.manifest.fps) % this.manifest.frameCount;
    return Math.floor(this.phase);
  }

  draw(image: Phaser.GameObjects.Image, size: number, frame: number, standHeight: number): void {
    const texture = this.key(size);
    if (image.texture.key !== texture) image.setTexture(texture, frame);
    else if (Number(image.frame.name) !== frame) image.setFrame(frame);
    const [x, y] = this.manifest.origin;
    const displaySize = standHeight / this.manifest.standingHeightInFrame;
    image.setOrigin(x, y).setDisplaySize(displaySize, displaySize);
  }
}
