"""Turn the generated cotton-paper master into a seamless, near-white fibre tile.

Run with Python + Pillow: python scripts/prepare-paper-texture.py
The tile multiplies over each surface's own ivory colour (background-blend-mode),
so surfaces keep their tint and only gain real paper fibres.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'artwork' / 'stationery' / 'cotton-paper.png'
TARGET = ROOT / 'src' / 'assets' / 'textures' / 'cotton-paper-512.webp'
SIZE = 512

with Image.open(SOURCE) as master:
    gray = ImageOps.grayscale(master.convert('RGB'))

# Remove the photograph's low-frequency lighting so tiles meet without banding:
# keep only the fibre detail (high-pass) around a flat mid-grey.
lighting = gray.filter(ImageFilter.GaussianBlur(48))
gray = ImageChops.add(ImageChops.subtract(gray, lighting, offset=128), Image.new('L', gray.size, 0))

# Seamless: blend the image with a half-offset copy whose seams sit in the
# middle, weighting the original towards the centre and the copy at the edges.
w, h = gray.size
shifted = ImageChops.offset(gray, w // 2, h // 2)
mask = Image.new('L', (w, h))
mask.putdata([
    int(255 * min(1.0, 2.2 * min(min(x, w - 1 - x) / (w / 2), min(y, h - 1 - y) / (h / 2))))
    for y in range(h) for x in range(w)
])
seamless = Image.composite(gray, shifted, mask)

# Normalise to a near-white multiply layer: mean ~248, gentle fibre contrast.
tile = seamless.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
mean = ImageStat.Stat(tile).mean[0]
tile = tile.point(lambda v: max(0, min(255, round(248 + (v - mean) * 1.6))))
warm = Image.merge('RGB', (tile, tile.point(lambda v: round(v * 0.993)), tile.point(lambda v: round(v * 0.975))))
TARGET.parent.mkdir(parents=True, exist_ok=True)
warm.save(TARGET, 'WEBP', quality=78, method=6)
print(f'{TARGET.name}: {TARGET.stat().st_size:,} bytes')
