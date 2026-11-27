import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("forest_batch_b", ROOT / "scripts/prepare-forest-batch-b.py")
batch = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(batch)


class ForestBatchBTest(unittest.TestCase):
    def test_bad_zip_is_rejected_before_unpacking(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "forest.zip"
            path.write_bytes(b"unexpected")
            with self.assertRaisesRegex(ValueError, "size or SHA-256"):
                batch.verify_delivery(path)

    def test_extrusion_preserves_straight_alpha_and_leaves_clear_gutter(self):
        sprite = Image.new("RGBA", (2, 2))
        sprite.putdata([(218, 132, 27, 120), (107, 43, 18, 220),
                        (53, 66, 71, 255), (255, 252, 15, 0)])
        atlas = Image.new("RGBA", (20, 20))
        batch.place_frame(atlas, sprite, 8, 8)
        self.assertEqual(atlas.crop((8, 8, 10, 10)).tobytes(), sprite.tobytes())
        self.assertEqual(atlas.getpixel((4, 4)), sprite.getpixel((0, 0)))
        self.assertEqual(atlas.getpixel((13, 13)), sprite.getpixel((1, 1)))
        self.assertEqual(atlas.crop((0, 0, 4, 20)).getchannel("A").getextrema(), (0, 0))
        self.assertEqual(atlas.crop((0, 14, 20, 18)).getchannel("A").getextrema(), (0, 0))
