"""Verify the pinned private Batch C ZIP and pack the approved runtime modules."""
import argparse
import hashlib
import io
import json
import stat
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

from PIL import Image

SOURCE = "471479f70e2d8e67d3a9a7d184ad2c71c5eda3e3"
SHA256 = "efe6af5c53a2afe34fccb5d4b52c8e06e8024188d2ab226b1cc407feecd6cb20"
SIZE = 8154989
# Widths are chosen for the displayed world scale, not for source-sheet uniformity.
WIDTHS = {
    "shrine-body": 248, "lantern-a": 80, "lantern-b": 88, "lantern-c": 80,
    "wind-arc": 128, "wind-circle": 128, "wind-butterfly": 60, "wind-vortex": 128,
}
EXTRUSION = 4
GUTTER = 4
WIDTH = 640


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verified_delivery(path):
    data = path.read_bytes()
    if len(data) != SIZE or sha(data) != SHA256:
        raise ValueError("Batch C archive size or hash mismatch")
    with ZipFile(io.BytesIO(data)) as archive:
        members = archive.infolist()
        names = {item.filename for item in members}
        if len(members) != 19 or len(names) != 19 or sum(i.file_size for i in members) > 10_000_000:
            raise ValueError("Unexpected ZIP structure")
        for item in members:
            name = PurePosixPath(item.filename)
            if name.is_absolute() or ".." in name.parts or "\\" in item.filename or stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError(f"Unsafe ZIP path: {name}")
        if archive.testzip():
            raise ValueError("ZIP CRC mismatch")
        sums = dict(line.split(maxsplit=1)[::-1] for line in archive.read("SHA256SUMS").decode().splitlines())
        if sums.keys() != names - {"SHA256SUMS"}:
            raise ValueError("Incomplete ZIP checksums")
        files = {name: archive.read(name) for name in sums}

    images = {}
    for name, payload in files.items():
        if sha(payload) != sums[name]:
            raise ValueError(f"Hash mismatch: {name}")
        if not name.endswith((".png", ".webp", ".jpg")):
            continue
        with Image.open(io.BytesIO(payload)) as image:
            image.verify()
        with Image.open(io.BytesIO(payload)) as image:
            image.load()
            images[name] = {"size": list(image.size), "mode": image.mode, "bytes": len(payload), "sha256": sums[name],
                            "alpha": list(image.getchannel("A").getextrema()) if "A" in image.mode else None}
    manifest = json.loads(files["runtime/landmarks.json"])
    entries = manifest["frames"]
    if len(entries) != 12 or {f"modules/{frame['name']}.png" for frame in entries} != {
        name for name in images if name.startswith("modules/")
    }:
        raise ValueError("Expected 12 modules and atlas entries")
    aw, ah = images["runtime/landmarks.webp"]["size"]
    if aw * ah * 4 != manifest["rgba_bytes"]:
        raise ValueError("Source atlas size mismatch")
    occupied = []
    with Image.open(io.BytesIO(files["runtime/landmarks.webp"])) as atlas:
        for entry in entries:
            module = images[f"modules/{entry['name']}.png"]
            if module["mode"] != "RGBA" or module["alpha"][0] != 0 or module["alpha"][1] < 200:
                raise ValueError("Module is missing useful transparency")
            x, y, w, h = (entry["frame"][k] for k in ("x", "y", "w", "h"))
            if not (x >= GUTTER and y >= GUTTER and w > 0 and h > 0 and x+w <= aw-GUTTER and y+h <= ah-GUTTER):
                raise ValueError("Source frame outside atlas padding")
            if any(x < x2 and y < y2 and x+w > x1 and y+h > y1 for x1, y1, x2, y2 in occupied):
                raise ValueError("Source frames overlap")
            occupied.append((x, y, x+w, y+h))
            if list(atlas.crop(occupied[-1]).getchannel("A").getextrema()) != entry["alpha_extrema"]:
                raise ValueError(f"Source atlas alpha differs: {entry['name']}")
    return files, sums, images, manifest


def sprite_from(payload, name, width):
    with Image.open(io.BytesIO(payload)) as source:
        sprite = source.copy()
    if name.startswith("wind-"):
        # Smooth the artificial straight outer boundaries without hard-keying the glow.
        alpha = sprite.getchannel("A")
        fringe = max(6, round(min(sprite.size) * .085))
        for y in range(sprite.height):
            for x in range(sprite.width):
                d = min(x, y, sprite.width-1-x, sprite.height-1-y)
                if d < fringe:
                    alpha.putpixel((x, y), round(alpha.getpixel((x, y)) * (d / fringe)**2))
        sprite.putalpha(alpha)
    return sprite.resize((width, round(sprite.height * width / sprite.width)), Image.Resampling.LANCZOS)


def pack(files):
    atlas = Image.new("RGBA", (WIDTH, 512))
    padding = EXTRUSION + GUTTER
    x = y = row = 0
    frames = {}
    for name, width in WIDTHS.items():
        sprite = sprite_from(files[f"modules/{name}.png"], name, width)
        w, h = sprite.size
        if x + w + 2 * padding > WIDTH:
            x, y, row = 0, y + row, 0
        if y + h + 2 * padding > atlas.height:
            raise ValueError("Batch C atlas exceeded height budget")
        fx, fy = x + padding, y + padding
        atlas.paste(sprite, (fx, fy))
        for left, right, out_x, out_width in [(0, 1, fx-4, 4), (0, w, fx, w), (w-1, w, fx+w, 4)]:
            for top, bottom, out_y, out_height in [(0, 1, fy-4, 4), (0, h, fy, h), (h-1, h, fy+h, 4)]:
                if out_width == w and out_height == h:
                    continue
                strip = sprite.crop((left, top, right, bottom))
                atlas.paste(strip.resize((out_width, out_height), Image.Resampling.NEAREST), (out_x, out_y))
        frames[name] = {"frame": {"x": fx, "y": fy, "w": w, "h": h}}
        x += w + 2 * padding
        row = max(row, h + 2 * padding)
    height = (y + row + 15) // 16 * 16
    return atlas.crop((0, 0, WIDTH, height)), frames


def prepare(archive, atlas_path, provenance_path):
    files, sums, images, manifest = verified_delivery(archive)
    atlas, frames = pack(files)
    if atlas.width * atlas.height * 4 > 5 * 1024**2 // 2:
        raise ValueError("Batch C texture exceeds 2.50 MiB")
    atlas_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(atlas_path, lossless=True, method=6, exact=True)
    output = {"sourceCommit": SOURCE, "archiveBytes": SIZE, "archiveSha256": SHA256, "sourceChecksums": sums,
              "sourceImages": images, "sourceAtlas": manifest, "frames": frames,
              "meta": {"image": atlas_path.name, "size": {"w": atlas.width, "h": atlas.height},
                       "extrusionPx": EXTRUSION, "gutterPx": GUTTER, "bytes": atlas_path.stat().st_size,
                       "rgbaBytes": atlas.width * atlas.height * 4, "sha256": sha(atlas_path.read_bytes())}}
    provenance_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("atlas", type=Path)
    parser.add_argument("provenance", type=Path)
    args = parser.parse_args()
    prepare(args.archive, args.atlas, args.provenance)
