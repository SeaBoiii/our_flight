"""Losslessly encode the approved display PNG without changing any pixels.

Run with Python + Pillow: python scripts/prepare-display-monogram.py
The original monogram and display PNG remain untouched.
"""
from pathlib import Path
from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / 'public'
TARGET = PUBLIC / 'monogram-a-and-n-display.webp'

with Image.open(PUBLIC / 'monogram-a-and-n-display.png') as source:
    source.save(TARGET, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    with Image.open(TARGET) as encoded:
        if source.convert('RGBA').tobytes() != encoded.convert('RGBA').tobytes():
            raise ValueError('Lossless display monogram pixels changed')

print(f'{TARGET.name}: {TARGET.stat().st_size:,} bytes; exact pixels preserved')
