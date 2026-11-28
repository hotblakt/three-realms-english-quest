import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("batch_c", ROOT / "scripts/prepare-forest-batch-c.py")
batch_c = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(batch_c)


class ForestBatchCTest(unittest.TestCase):
    def test_wrong_archive_is_rejected_before_unpacking(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "invalid.zip"
            path.write_bytes(b"wrong")
            with self.assertRaisesRegex(ValueError, "size or hash"):
                batch_c.verified_delivery(path)

    def test_runtime_atlas_matches_provenance_and_budget(self):
        provenance = json.loads((ROOT / "docs/forest-batch-c-provenance.json").read_text())
        meta = provenance["meta"]
        path = ROOT / "public/forest-batch-c" / meta["image"]
        payload = path.read_bytes()
        self.assertEqual(len(payload), meta["bytes"])
        self.assertEqual(hashlib.sha256(payload).hexdigest(), meta["sha256"])
        self.assertEqual(set(provenance["frames"]), set(batch_c.WIDTHS))
        with Image.open(path) as atlas:
            self.assertEqual(atlas.format, "WEBP")
            self.assertEqual(atlas.mode, "RGBA")
            self.assertEqual(atlas.size, (meta["size"]["w"], meta["size"]["h"]))
            self.assertEqual(atlas.width * atlas.height * 4, meta["rgbaBytes"])
            self.assertLessEqual(meta["rgbaBytes"], 5 * 1024**2 // 2)
            for name, entry in provenance["frames"].items():
                with self.subTest(frame=name):
                    frame = entry["frame"]
                    x, y, w, h = (frame[k] for k in ("x", "y", "w", "h"))
                    self.assertEqual(atlas.crop((x, y, x + 1, y + h)).tobytes(),
                                     atlas.crop((x - 4, y, x - 3, y + h)).tobytes())
                    self.assertEqual(atlas.crop((x, y - 8, x + w, y - 4)).getchannel("A").getextrema(), (0, 0))
                    if name.startswith("wind-"):
                        self.assertLess(atlas.crop((x, y, x + w, y + 1)).getchannel("A").getextrema()[1], 12)
