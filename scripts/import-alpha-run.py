"""Import a horizontal row of transparent poses for review. Offline: Pillow, NumPy, SciPy."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import stat
from zipfile import ZipFile

import numpy as np
from PIL import Image
from scipy.ndimage import find_objects, label


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_source(path):
    with ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) != 1:
            raise ValueError('Expected one PNG')
        entry = entries[0]
        member = PurePosixPath(entry.filename)
        kind = stat.S_IFMT(entry.external_attr >> 16)
        if (member.is_absolute() or '..' in member.parts or '\\' in entry.filename
                or member.suffix != '.png' or kind not in (0, stat.S_IFREG)
                or not 0 < entry.file_size <= 16_000_000):
            raise ValueError('Unsafe PNG entry')
        raw = archive.read(entry)
        with Image.open(io.BytesIO(raw)) as image:
            if image.format != 'PNG' or image.mode != 'RGBA' or max(image.size) > 4096:
                raise ValueError('Expected a bounded RGBA PNG')
            image.verify()
        image = Image.open(io.BytesIO(raw))
        image.load()
        return entry.filename, digest(raw), image


def split_poses(image, count, cutoff):
    pixels = np.array(image)
    alpha = pixels[:, :, 3]
    labels, _ = label(alpha > cutoff)
    counts = np.bincount(labels.ravel())
    bounds = find_objects(labels)
    # Require exactly the expected number of substantial silhouettes.
    subjects = [i for i in range(1, len(counts)) if counts[i] >= max(4, alpha.size // 1000)]
    if len(subjects) != count:
        raise ValueError(f'Expected {count} separate poses, found {len(subjects)}')
    subjects.sort(key=lambda i: bounds[i - 1][1].start)
    for subject in subjects:
        ys, xs = bounds[subject - 1]
        rgba = pixels[ys, xs].copy()
        weight = (rgba[:, :, 3].astype(float) - cutoff) / (230 - cutoff)
        rgba[:, :, 3] = np.where(labels[ys, xs] == subject, np.clip(weight, 0, 1) * 255, 0)
        yield (xs.start, ys.start, xs.stop, ys.stop), Image.fromarray(rgba)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('zip', type=Path)
    parser.add_argument('recipe', type=Path)
    args = parser.parse_args()
    recipe = json.loads(args.recipe.read_text())
    member, source_hash, image = read_source(args.zip)
    anchors = recipe['anchors']
    poses = list(split_poses(image, len(anchors), recipe['alphaCutoff']))
    size = 384
    foot = (192, 338)
    normalized = []
    for (bounds, pose), (x, y) in zip(poses, anchors):
        scale = recipe['scale']
        pose = pose.resize(tuple(round(v * scale) for v in pose.size), Image.Resampling.LANCZOS)
        origin = (round(foot[0] + (bounds[0] - x) * scale), round(foot[1] + (bounds[1] - y) * scale))
        if min(origin) < 0 or any(o + s > size for o, s in zip(origin, pose.size)):
            raise ValueError('Pose clips after normalization')
        frame = Image.new('RGBA', (size, size))
        frame.paste(pose, origin)
        normalized.append(frame)
    folder = Path('public/eiku-run')
    manifest = {'id': 'eiku-chatgpt-run-review', 'frameCount': len(poses), 'fps': 8,
                'referenceSpeed': 123, 'standingHeightInFrame': 316 / size, 'origin': [v / size for v in foot],
                'textures': {}}
    for resolution in (256, 384):
        atlas = Image.new('RGBA', (resolution * 3, resolution * ((len(poses) + 2) // 3)))
        for index, frame in enumerate(normalized):
            atlas.paste(frame.resize((resolution, resolution), Image.Resampling.LANCZOS),
                        (index % 3 * resolution, index // 3 * resolution))
        path = folder / f'chatgpt-run-{resolution}.webp'
        atlas.save(path, lossless=True, method=6)
        manifest['textures'][resolution] = {'url': path.name, 'bytes': path.stat().st_size,
                                           'width': atlas.width, 'height': atlas.height, 'sha256': digest(path.read_bytes())}
    alpha = image.getchannel('A').histogram()
    audit = {'commit': recipe['commit'], 'zipSha256': digest(args.zip.read_bytes()), 'member': member,
             'pngSha256': source_hash, 'dimensions': image.size, 'mode': image.mode,
             'alphaZero': alpha[0], 'alphaPartial': sum(alpha[1:255]), 'alphaOpaque': alpha[255],
             'poseBounds': [box for box, _ in poses], 'recipe': recipe}
    for path, data in [('forest-preview/chatgpt-run-manifest.json', manifest), ('docs/chatgpt-run-audit.json', audit)]:
        Path(path).write_text(json.dumps(data, indent=2) + '\n')


if __name__ == '__main__':
    main()
