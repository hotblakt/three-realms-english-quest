"""Import the reviewed Eiku run from a FrameSprite ZIP. Requires Pillow."""
import hashlib
import io
import json
import math
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
from PIL import Image

LOOP = range(19, 25)
SCALE = 316 / 724


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_frames(archive):
    with ZipFile(archive) as source:
        members = [entry for entry in source.infolist() if not entry.is_dir()]
        files = {}
        for entry in members:
            path = PurePosixPath(entry.filename)
            kind = (entry.external_attr >> 16) & 0o170000
            if (path.name in files or path.is_absolute() or '..' in path.parts
                    or '\\' in entry.filename or kind not in (0, 0o100000)
                    or entry.file_size > 32 * 1024**2):
                raise ValueError(f'Unsafe ZIP entry: {entry.filename}')
            files[path.name] = entry
        layout = json.loads(source.read(files['layout.json']))
        timing = json.loads(source.read(files['timing.json']))
        count = layout['frameCount']
        samples, delays = timing['sampleTimesMs'], timing['frameDelaysMs']
        if not (count == timing['frameCount'] == len(samples) == len(delays) == 36
                and all(math.isfinite(t) for t in samples)
                and all(a < b for a, b in zip(samples, samples[1:]))
                and all(math.isfinite(t) and t > 0 for t in delays)
                and math.isclose(sum(delays), timing['durationMs'], abs_tol=.001)
                and math.isclose(count / timing['durationMs'] * 1000, timing['fps'], abs_tol=.001)):
            raise ValueError('Invalid frame timing')
        w, h = layout['frameWidth'], layout['frameHeight']
        if (w, h) != (768, 1152):
            raise ValueError('Review offsets before importing a different source canvas')
        frames, pages = [], []
        expected = {'layout.json', 'timing.json'}
        for index, page in enumerate(layout['pages'], 1):
            name = f'sheet_{index:02}.png'
            expected.add(name)
            raw = source.read(files[name])
            with Image.open(io.BytesIO(raw)) as image:
                image.verify()
            image = Image.open(io.BytesIO(raw))
            columns, rows = page['columns'], page['rows']
            dims = (columns * w, rows * h)
            if not (image.format == 'PNG' and image.mode == 'RGBA'
                    and image.size == dims == (page['width'], page['height'])
                    and math.prod(dims) == page['pixelCount'] <= 16_000_000
                    and page['startIndex'] == len(frames)
                    and 0 < page['frameCount'] <= columns * rows):
                raise ValueError(f'Invalid page {name}')
            pages.append({'name': name, 'size': dims, 'mode': image.mode, 'sha256': sha(raw)})
            for i in range(page['frameCount']):
                x, y = i % columns * w, i // columns * h
                frame = image.crop((x, y, x+w, y+h))
                if frame.getchannel('A').getextrema() != (0, 255):
                    raise ValueError(f'Unexpected alpha in frame {len(frames)}')
                frames.append(frame)
        if len(frames) != count or files.keys() != expected:
            raise ValueError('Archive entries do not match layout')
        metadata = {name: sha(source.read(files[name])) for name in ('layout.json', 'timing.json')}
        return frames, pages, timing, metadata


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
