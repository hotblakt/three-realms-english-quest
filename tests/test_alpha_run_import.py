import io
from pathlib import Path
import runpy
import tempfile
import unittest
from zipfile import ZipFile

from PIL import Image, ImageDraw

IMPORTER = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/import-alpha-run.py'))


class ImportTests(unittest.TestCase):
    def test_split_silhouettes_in_horizontal_order_and_remove_low_alpha(self):
        image = Image.new('RGBA', (80, 60), (150, 150, 150, 20))
        draw = ImageDraw.Draw(image)
        draw.rectangle((2, 7, 31, 43), fill=(20, 60, 200, 248))
        draw.rectangle((43, 5, 78, 40), fill=(14, 22, 29, 252))
        draw.point((40, 44), fill=(255, 255, 255, 255))
        poses = list(IMPORTER['split_poses'](image, 2, 100))
        self.assertEqual([box for box, _ in poses], [(2, 7, 32, 44), (43, 5, 79, 41)])
        self.assertEqual(poses[0][1].getpixel((0, 0)), (20, 60, 200, 255))
        with self.assertRaisesRegex(ValueError, 'separate poses'):
            list(IMPORTER['split_poses'](image, 3, 100))

    def test_archive_reads_rgba_and_rejects_path_traversal(self):
        data = io.BytesIO()
        Image.new('RGBA', (3, 9)).save(data, format='PNG')
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / 'source.zip'
            with ZipFile(archive, 'w') as output:
                output.writestr('characters/pose.png', data.getvalue())
            self.assertEqual(IMPORTER['read_source'](archive)[2].size, (3, 9))
            with ZipFile(archive, 'w') as output:
                output.writestr('../pose.png', data.getvalue())
            with self.assertRaisesRegex(ValueError, 'Unsafe'):
                IMPORTER['read_source'](archive)
