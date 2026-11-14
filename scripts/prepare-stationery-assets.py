"""Encode the envelope and venue-map masters for delivery; no retouching.

Run with Python + Pillow (AVIF support): python scripts/prepare-stationery-assets.py
The blank wax seal is encoded by scripts/prepare-flight-assets.py.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
STATIONERY = ROOT / 'artwork' / 'stationery'
TARGET = ROOT / 'public' / 'flight'

def encode(source: Path, name: str, size: tuple[int, int], quality: int, avif: bool = False, alpha: bool = False) -> None:
    with Image.open(source) as master:
        image = master.convert('RGBA' if alpha else 'RGB').resize(size, Image.Resampling.LANCZOS)
        if alpha and image.getextrema()[3][0] != 0:
            raise ValueError(f'{name} must retain transparent alpha')
        image.save(TARGET / f'{name}.webp', quality=quality, method=6)
        if avif:
            image.save(TARGET / f'{name}.avif', quality=quality - 18, speed=4)

# Envelope prelude: linen with arch-window light, the night-sky liner and the
# arch window printed on the card (the same art as the printed invitation).
encode(STATIONERY / 'envelope-linen.png', 'envelope-linen-720', (720, 1280), 70)
encode(STATIONERY / 'envelope-liner.png', 'envelope-liner-640', (640, 730), 76)
encode(STATIONERY / 'arch-window.png', 'arch-window-336', (336, 600), 84, alpha=True)
# Getting here: the paper model of the airport precinct.
encode(ROOT / 'artwork' / 'flight' / 'venue-map.png', 'venue-map-1280', (1280, 958), 78, avif=True)

for name in ['envelope-linen-720.webp', 'envelope-liner-640.webp', 'arch-window-336.webp', 'venue-map-1280.webp', 'venue-map-1280.avif']:
    print(f'{name}: {(TARGET / name).stat().st_size:,} bytes')
