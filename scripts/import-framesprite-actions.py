"""Review and export a FrameSprite idle/run archive. Requires Pillow and NumPy."""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from framesprite_source import read_frames, sha


def detect(frames, threshold):
    """Suggest motion spans from lower-body silhouette departure from the first stance."""
    masks = []
    for frame in frames:
        alpha = frame.getchannel('A').resize((96, 144), Image.Resampling.BOX)
        masks.append(np.array(alpha)[78:120, :] > 145)
    base = masks[0]
    scores = [float(np.count_nonzero(a ^ base) / max(1, np.count_nonzero(a | base))) for a in masks]
    flags = [np.median(scores[max(0, i-1):i+2]) >= threshold for i in range(len(scores))]
    spans = []
    for i, running in enumerate(flags):
        action = 'run' if running else 'idle'
        if spans and spans[-1]['action'] == action:
            spans[-1]['endExclusive'] = i + 1
        else:
            spans.append({'action': action, 'start': i, 'endExclusive': i + 1})
    return spans, [round(v, 4) for v in scores]


def contact(frames, path):
    board = Image.new('RGB', (960, math.ceil(len(frames)/10) * 115), '#405458')
    labels = ImageDraw.Draw(board)
    for i, frame in enumerate(frames):
        pose = frame.copy()
        pose.thumbnail((92, 98))
        x, y = i % 10 * 96, i // 10 * 115
        board.paste(pose, (x+(96-pose.width)//2, y), pose)
        labels.text((x+4, y+99), str(i), fill='white')
    board.save(path, quality=86)


def normalize(frame, anchor, scale):
    rgba = np.array(frame)
    r, g, b, a = [rgba[:, :, i].astype(np.int16) for i in range(4)]
    excess = g - np.maximum(r, b)
    a[(a <= 5) | ((a < 230) & (excess > 60))] = 0
    rgba[:, :, 3] = a
    rgba[:, :, 1] = g - np.where((a < 245) & (excess > 15), excess - 10, 0)
    image = Image.fromarray(rgba)
    bounds = image.getchannel('A').getbbox()
    if not bounds or any(v == limit for v, limit in zip(bounds, (0, 0, frame.width, frame.height))):
        raise ValueError('Empty or clipped pose')
    x, y = anchor
    pose = image.crop(bounds)
    pose = pose.resize(tuple(round(v*scale) for v in pose.size), Image.Resampling.LANCZOS)
    origin = (round(192 + (bounds[0]-x)*scale), round(338 + (bounds[1]-y)*scale))
    if min(origin) < 0 or max(o+s for o, s in zip(origin, pose.size)) > 384:
        raise ValueError('Normalized pose does not fit')
    out = Image.new('RGBA', (384, 384))
    out.paste(pose, origin)
    return out


def export(action, frames, timing, recipe, runtime):
    start, end = action['range']
    if not 0 <= start < end <= len(frames) or end-start < 2:
        raise ValueError('Invalid manually reviewed range')
    poses = [normalize(f, recipe['anchor'], recipe['scale']) for f in frames[start:end]]
    name = recipe['id'] + '-' + action['action']
    fps = round(len(poses)*1000/sum(timing['frameDelaysMs'][start:end]), 2)
    manifest = {'id':name, 'frameCount':len(poses), 'fps':fps, 'referenceSpeed':123,
                'origin':[.5,338/384], 'standingHeightInFrame':316/384, 'textures':{}}
    for size in (256,384):
        cols = math.ceil(math.sqrt(len(poses)))
        rows = math.ceil(len(poses)/cols)
        if max(cols, rows) * size > 4096:
            raise ValueError('Review a shorter interval before packing')
        atlas = Image.new('RGBA',(size*cols,size*rows))
        for i, pose in enumerate(poses):
            atlas.paste(pose.resize((size,size),Image.Resampling.LANCZOS),(i%cols*size,i//cols*size))
        path = runtime/f'{name}-{size}.webp'
        atlas.save(path, lossless=True, method=6)
        data = path.read_bytes()
        manifest['textures'][size] = {'url':path.name,'bytes':len(data),'sha256':sha(data),
                                      'width':atlas.width,'height':atlas.height}
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('recipe', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    recipe = json.loads(args.recipe.read_text())
    frames,pages,timing,metadata = read_frames(args.archive)
    spans,scores = detect(frames,recipe.get('motionThreshold',.4))
    args.output.mkdir(parents=True,exist_ok=True)
    contact(frames,args.output/'contact.webp')
    actions = [export(a,frames,timing,recipe,args.output) for a in recipe.get('actions',[]) if a['approved']]
    for action in actions:
        (args.output/f"{action['id']}.json").write_text(json.dumps(action,indent=2)+'\n')
    report = {'archiveSha256':sha(args.archive.read_bytes()), 'pages':pages, 'timing':timing,
              'metadataSha256':metadata,'motionSpans':spans,'motionScores':scores,'recipe':recipe}
    (args.output/'provenance.json').write_text(json.dumps(report,indent=2)+'\n')
    print(spans)

if __name__ == '__main__':
    main()
