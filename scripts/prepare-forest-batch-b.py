"""Verify the pinned Batch B delivery and prepare an offline review atlas."""
import argparse
import hashlib
import io
import json
import stat
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

from PIL import Image

SOURCE_COMMIT = "7d83f3fec5fb68ec177d789270b800ce34495e04"
ARCHIVE_SIZE = 13612263
ARCHIVE_SHA256 = "280d449caa340c1e9ac56176dd017cb51474e37250586f3423973fc2ac394fe9"
BUDGET_BYTES = 5 * 1024**2 // 2
EXTRUSION = 4
GUTTER = 4
BORDER = EXTRUSION + GUTTER
# Maximum widths. Use the source aspect ratio for height.
SELECTED = {
    "canopy-01": 192, "canopy-02": 192, "canopy-03": 152,
    "bamboo-01": 156, "bamboo-02": 140,
    "root-04": 108, "leaf-litter-01": 108, "moss-01": 108, "wet-ground-02": 108,
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def verify_delivery(path):
    raw = path.read_bytes()
    if len(raw) != ARCHIVE_SIZE or sha256(raw) != ARCHIVE_SHA256:
        raise ValueError("Batch B archive size or SHA-256 does not match the handoff")
    with ZipFile(io.BytesIO(raw)) as archive:
        members = archive.infolist()
        names = {member.filename for member in members}
        if len(members) != 26 or len(names) != 26 or sum(m.file_size for m in members) > 20_000_000:
            raise ValueError("Unexpected Batch B archive structure")
        for member in members:
            path = PurePosixPath(member.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in member.filename or stat.S_ISLNK(member.external_attr >> 16):
                raise ValueError(f"Unsafe ZIP member: {member.filename}")
        if archive.testzip() is not None:
            raise ValueError("ZIP CRC validation failed")
        checksums = dict(line.split(maxsplit=1)[::-1]
                         for line in archive.read("SHA256SUMS").decode().splitlines() if line.strip())
        if checksums.keys() != names - {"SHA256SUMS"}:
            raise ValueError("Checksum coverage mismatch")
        items = {name: archive.read(name) for name in checksums}
    for name, content in items.items():
        if checksums[name] != sha256(content):
            raise ValueError(f"Member checksum mismatch: {name}")
        if name.endswith((".png", ".jpg", ".webp")):
            with Image.open(io.BytesIO(content)) as image:
                image.verify()
    manifest = json.loads(items["manifest.json"])
    candidate_names = {Path(name).stem for name in items if name.startswith("sprites/")}
    if len(manifest) != 16 or {entry["name"] for entry in manifest} != candidate_names:
        raise ValueError("Unexpected candidate manifest")
    for entry in manifest:
        name = entry["name"]
        with Image.open(io.BytesIO(items[f"sprites/{name}.png"])) as sprite:
            if sprite.mode != "RGBA" or list(sprite.size) != entry["sprite_size"] or list(sprite.getchannel("A").getextrema()) != entry["alpha_extrema"]:
                raise ValueError(f"Image metadata mismatch: {name}")
        with Image.open(io.BytesIO(items[f'runtime/b{entry["atlas"] + 1}-candidate.webp'])) as atlas:
            rect = entry["frame"]
            if not (rect["x"] >= EXTRUSION and rect["y"] >= EXTRUSION
                    and rect["x"] + rect["w"] <= atlas.width - EXTRUSION
                    and rect["y"] + rect["h"] <= atlas.height - EXTRUSION):
                raise ValueError(f"Invalid source atlas rectangle: {name}")
    return items, checksums, manifest


def place_frame(atlas, sprite, x, y):
    """Copy four edge pixels beyond the frame and keep a separate clear gutter."""
    width, height = sprite.size
    atlas.paste(sprite, (x, y))
    for offset_x, source_x, strip_width in [(-EXTRUSION, 0, EXTRUSION), (0, 0, width), (width, width - 1, EXTRUSION)]:
        for offset_y, source_y, strip_height in [(-EXTRUSION, 0, EXTRUSION), (0, 0, height), (height, height - 1, EXTRUSION)]:
            if offset_x == offset_y == 0:
                continue
            strip = sprite.crop((source_x, source_y, source_x + (width if offset_x == 0 else 1),
                                 source_y + (height if offset_y == 0 else 1)))
            atlas.paste(strip.resize((strip_width, strip_height), Image.Resampling.NEAREST), (x + offset_x, y + offset_y))


def prepare(archive, output):
    items, checksums, manifest = verify_delivery(archive)
    width, max_height = 768, 768
    atlas = Image.new("RGBA", (width, max_height))
    frames = {}
    x = y = row_height = 0
    for name, target_width in SELECTED.items():
        with Image.open(io.BytesIO(items[f"sprites/{name}.png"])) as source:
            sprite = source.resize((target_width, round(source.height * target_width / source.width)),
                                   Image.Resampling.LANCZOS)
        cell_width, cell_height = sprite.width + 2 * BORDER, sprite.height + 2 * BORDER
        if x + cell_width > width:
            x, y, row_height = 0, y + row_height, 0
        if y + cell_height > max_height:
            raise ValueError("Review atlas exceeded maximum height")
        place_frame(atlas, sprite, x + BORDER, y + BORDER)
        frames[name] = {"frame": {"x": x + BORDER, "y": y + BORDER, "w": sprite.width, "h": sprite.height}}
        x += cell_width
        row_height = max(row_height, cell_height)
    height = (y + row_height + 15) // 16 * 16
    decoded_size = width * height * 4
    if decoded_size > BUDGET_BYTES:
        raise ValueError("Batch B texture budget exceeded")
    output.mkdir(parents=True, exist_ok=True)
    target = output / "forest-batch-b.webp"
    atlas.crop((0, 0, width, height)).save(target, lossless=True, method=6, exact=True)
    report = {
        "sourceCommit": SOURCE_COMMIT, "archiveBytes": ARCHIVE_SIZE, "archiveSha256": ARCHIVE_SHA256,
        "sourceChecksums": checksums, "sourceManifest": manifest,
        "frames": frames,
        "meta": {"image": target.name, "size": {"w": width, "h": height}, "extrusionPx": EXTRUSION,
                 "gutterPxPerFrameSide": GUTTER, "bytes": target.stat().st_size,
                 "rgbaBytes": decoded_size, "sha256": sha256(target.read_bytes())},
    }
    (output / "forest-batch-b.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    prepare(args.archive, args.output)
