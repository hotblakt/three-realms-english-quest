"""Validated FrameSprite page and timing reader."""
import hashlib
import io
import json
import math
from pathlib import PurePosixPath
from zipfile import ZipFile
from PIL import Image

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
        if not (count == timing['frameCount'] == len(samples) == len(delays) <= 240
                and all(math.isfinite(t) for t in samples)
                and all(a < b for a, b in zip(samples, samples[1:]))
                and all(math.isfinite(t) and t > 0 for t in delays)
                and math.isclose(sum(delays), timing['durationMs'], abs_tol=.001)
                and math.isclose(count / timing['durationMs'] * 1000, timing['fps'], abs_tol=.001)):
            raise ValueError('Invalid frame timing')
        w, h = layout['frameWidth'], layout['frameHeight']
        if not (0 < w <= 2048 and 0 < h <= 2048 and 0 < count and count * w * h <= 150_000_000):
            raise ValueError('Unsupported source canvas or frame budget')
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
