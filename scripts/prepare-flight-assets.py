"""Encode the approved generated masters; no compositing or visual retouching.

Run with Python + Pillow (AVIF support): python scripts/prepare-flight-assets.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'artwork' / 'flight'
TARGET = ROOT / 'public' / 'flight'
TARGET.mkdir(parents=True, exist_ok=True)

for name, width in [
    ('airport-portrait', 640), ('airport-landscape', 1440),
    ('runway-portrait', 640), ('runway-landscape', 1440),
    ('cabin-portrait', 768), ('cabin-landscape', 1440),
    ('sky-portrait', 768), ('sky-landscape', 1440),
    ('aircraft', 960),
]:
    source_name = 'runway' if name.startswith('runway-') else name
    with Image.open(SOURCE / f'{source_name}.png') as master:
        resized = master.resize((width, round(master.height * width / master.width)), Image.Resampling.LANCZOS)
        resized.save(TARGET / f'{name}-{width}.webp', quality=82, method=6)
        if name != 'aircraft':
            resized.save(TARGET / f'{name}-{width}.avif', quality=62, speed=4)
        elif resized.mode != 'RGBA' or resized.getextrema()[3][0] != 0:
            raise ValueError(f'{name} must retain transparent alpha')

for asset in sorted(TARGET.iterdir()):
    print(f'{asset.name}: {asset.stat().st_size:,} bytes')
