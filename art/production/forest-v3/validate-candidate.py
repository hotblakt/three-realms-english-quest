"""Read-only integrity checks for Forest 3.0 Batch 002 candidate images."""
import argparse
import hashlib
import json
from pathlib import Path
import re

from PIL import Image

PAGES = {
    "hayate": (800, 700),
    "small-enemies": (512, 512),
    "guardian": (768, 512),
    "combat-fx": (256, 256),
    "hud": (512, 256),
}
P0_LIMIT = sum(width * height * 4 for width, height in PAGES.values())


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verify_image(root, entry, atlas_limit=None):
    relative = Path(entry["path"])
    path = (root / relative).resolve()
    if relative.is_absolute() or ".." in relative.parts or not path.is_relative_to(root):
        raise ValueError(f"invalid asset path: {relative}")
    if path.stat().st_size != entry["bytes"] or sha256(path) != entry["sha256"]:
        raise ValueError(f"byte count or SHA-256 mismatch: {relative}")

    with Image.open(path) as image:
        width, height = image.size
        if [width, height] != [entry["width"], entry["height"]]:
            raise ValueError(f"size mismatch: {relative}")
        if atlas_limit:
            if image.format != "WEBP" or width > atlas_limit[0] or height > atlas_limit[1]:
                raise ValueError(f"invalid P0 WebP page format or dimensions: {relative}")
        elif image.format != "PNG" or min(width, height) < 512:
            raise ValueError(f"source must be PNG with both sides at least 512 px: {relative}")

        if image.mode != "RGBA" or getattr(image, "n_frames", 1) != 1:
            raise ValueError(f"expected one RGBA image: {relative}")
        alpha = image.getchannel("A")
        if alpha.getextrema() != (0, 255):
            raise ValueError(f"expected transparent and opaque pixels: {relative}")
        if not atlas_limit:
            left, top, right, bottom = alpha.getbbox()
            if min(left, top, width - right, height - bottom) < 4:
                raise ValueError(f"source needs 4 px transparent margin: {relative}")
    return width * height * 4


def validate(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest["schemaVersion"] != 1 or manifest["batch"] != "002":
        raise ValueError("expected schema 1, Batch 002")
    source = manifest["source"]
    for field in ("privateRepository", "archivePath", "rightsEvidence"):
        if not source[field]:
            raise ValueError(f"missing source {field}")
    if not re.fullmatch(r"[0-9a-f]{40}", source["commit"] or ""):
        raise ValueError("missing valid private commit")
    if not re.fullmatch(r"[0-9a-f]{64}", source["archiveSha256"] or ""):
        raise ValueError("missing valid archive SHA-256")
    if not isinstance(source["archiveBytes"], int) or source["archiveBytes"] <= 0:
        raise ValueError("missing positive archive byte count")

    root = manifest_path.resolve().parent
    if not manifest["files"] and not manifest["atlasPages"]:
        raise ValueError("manifest contains no candidate images")
    for entry in manifest["files"]:
        verify_image(root, entry)
    seen = set()
    decoded_bytes = 0
    for page in manifest["atlasPages"]:
        role = page["pageRole"]
        if role not in PAGES or role in seen:
            raise ValueError(f"unknown or repeated P0 page role: {role}")
        seen.add(role)
        decoded_bytes += verify_image(root, page, PAGES[role])
    if decoded_bytes > P0_LIMIT:
        raise ValueError("combined P0 decoded byte limit exceeded")
    return decoded_bytes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    try:
        decoded_bytes = validate(args.manifest)
    except (OSError, ValueError, KeyError, TypeError, Image.DecompressionBombError) as error:
        parser.exit(1, f"Candidate validation failed: {error}\n")
    print(f"Candidate integrity checks passed. P0 decoded atlas bytes: {decoded_bytes:,}.")


if __name__ == "__main__":
    main()
