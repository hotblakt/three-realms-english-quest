import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class ForestIdleFramesTest(unittest.TestCase):
    def test_all_directional_idle_frames_have_visible_character_data(self):
        for direction in ("north", "south", "east", "west"):
            path = ROOT / "forest-preview" / f"{direction}-idle-manifest.json"
            manifest = json.loads(path.read_text())
            self.assertEqual(manifest["origin"], [.5, 338 / 384])
            for size in (256, 384):
                entry = manifest["textures"][str(size)]
                with Image.open(ROOT / "public/eiku-run" / entry["url"]) as atlas:
                    alpha = atlas.getchannel("A")
                    columns = atlas.width // size
                    for index in range(manifest["frameCount"]):
                        with self.subTest(direction=direction, size=size, index=index):
                            x, y = index % columns * size, index // columns * size
                            frame = alpha.crop((x, y, x + size, y + size))
                            self.assertGreater(sum(frame.histogram()[64:]), size * size * .1)
