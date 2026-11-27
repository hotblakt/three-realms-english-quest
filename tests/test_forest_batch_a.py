import hashlib
import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class ForestBatchATest(unittest.TestCase):
    def test_runtime_images_match_provenance_and_budget(self):
        entries = json.loads((ROOT / "docs/forest-batch-a-provenance.json").read_text())["runtime"]
        total = 0
        for key, entry in entries.items():
            with self.subTest(key=key):
                path = ROOT / "public/forest-batch-a" / entry["url"]
                data = path.read_bytes()
                self.assertEqual(len(data), entry["bytes"])
                self.assertEqual(hashlib.sha256(data).hexdigest(), entry["sha256"])
                with Image.open(path) as image:
                    self.assertEqual(image.format, "WEBP")
                    self.assertEqual(list(image.size), entry["size"])
                    area = image.width * image.height * 4
                    self.assertEqual(area, entry["rgbaBytes"])
                    total += area
                    if key != "batch-water":
                        low, high = image.getchannel("A").getextrema()
                        self.assertEqual(low, 0)
                        self.assertGreater(high, 200)
        self.assertLessEqual(total, 2 * 1024**2)

    def test_water_wraps_without_boundary_color_change(self):
        with Image.open(ROOT / "public/forest-batch-a/batch-water.webp") as water:
            width, height = water.size
            self.assertEqual(water.crop((0, 0, 1, height)).tobytes(),
                             water.crop((width - 1, 0, width, height)).tobytes())
            self.assertEqual(water.crop((0, 0, width, 1)).tobytes(),
                             water.crop((0, height - 1, width, height)).tobytes())
