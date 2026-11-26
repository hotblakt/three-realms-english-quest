"""Import the reviewed Eiku run from a FrameSprite ZIP. Requires Pillow."""
import json
import sys
from pathlib import Path
from framesprite_source import read_frames, sha
from PIL import Image

LOOP = range(19, 25)
SCALE = 316 / 724


def clean(frame):
    # Keep one transform for all poses. Airborne feet must stay above the ground.
    for y in range(236, 938):
        for x in range(65, 665):
            r, g, b, a = frame.getpixel((x, y))
            if 0 < a < 225:
                if a <= 5:
                    frame.putpixel((x, y), (0, 0, 0, 0))
                elif g > max(r, b) + 13:
                    frame.putpixel((x, y), (r, min(g, max(r, b)+10), b, a))
    crop = frame.crop((65, 236, 665, 938))
    assert frame.getchannel('A').point(lambda a: 255 if a > 100 else 0).getbbox()[3] <= 938
    result = Image.new('RGBA', (384, 384))
    result.paste(crop.resize((round(crop.width*SCALE), round(crop.height*SCALE)), Image.Resampling.LANCZOS),
                 (round(192+(65-384)*SCALE), round(338+(236-930)*SCALE)))
    return result


def main():
    archive = Path(sys.argv[1])
    frames, pages, timing, metadata = read_frames(archive)
    if len(frames) != 36 or frames[0].size != (768, 1152):
        raise ValueError("Right-run calibration requires the reviewed 36-frame source")
    poses = [clean(frames[index]) for index in LOOP]
    target = Path('public/eiku-run')
    target.mkdir(parents=True, exist_ok=True)
    textures = {}
    for size in (256, 384):
        atlas = Image.new('RGBA', (size * 3, size * 2))
        for index, pose in enumerate(poses):
            atlas.paste(pose.resize((size, size), Image.Resampling.LANCZOS),
                        (index % 3 * size, index // 3 * size))
        file = target / f'east-run-{size}.webp'
        atlas.save(file, lossless=True, method=6)
        textures[size] = {'url': file.name, 'bytes': file.stat().st_size,
                          'sha256': sha(file.read_bytes()), 'width': atlas.width, 'height': atlas.height}
    manifest = {'id': 'eiku-east-run', 'action': 'run', 'direction': 'east', 'frameCount': len(poses),
                'fps': 8, 'referenceSpeed': 123, 'standingHeightInFrame': 316 / 384,
                'origin': [0.5, 338 / 384], 'textures': textures}
    Path('forest-preview/run-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    provenance = {'sourceCommit': '151341b4ce8200bdd2449e6e547e1aa47436809c',
                  'zipSha256': sha(archive.read_bytes()), 'frameDimensions': [768, 1152],
                  'pages': pages, 'metadataSha256': metadata, 'timing': timing,
                  'loopSourceIndices': list(LOOP), 'sourceOrigin': [384, 930],
                  'allFrameAlphaBoundsAt100': [f.getchannel('A').point(lambda a:255 if a>100 else 0).getbbox()
                                               for f in frames]}
    Path('docs/eiku-run-provenance.json').write_text(json.dumps(provenance, indent=2)+'\n')


if __name__ == '__main__':
    main()
