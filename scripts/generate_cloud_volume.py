"""Generate a seamless 128-cubed fractal cloud field packed as a 2D atlas."""
import sys
import numpy as np
from PIL import Image

SIZE = 128
TILES_X = 16
TILE = SIZE + 2
rng = np.random.default_rng(20261106)
frequency = np.fft.fftfreq(SIZE)
k2 = sum(axis * axis for axis in np.meshgrid(frequency, frequency, frequency, indexing="ij"))

def field(radius):
    white = rng.normal(size=(SIZE, SIZE, SIZE))
    spectrum = np.fft.fftn(white) * np.exp(-2 * np.pi * np.pi * radius * radius * k2)
    smooth = np.fft.ifftn(spectrum).real
    return (smooth - smooth.mean()) / smooth.std()

volume = .60 * field(7.0) + .28 * field(3.1) + .12 * field(1.2)
volume = np.clip(.5 + volume * .20, 0, 1)
atlas = np.empty((TILE * (SIZE // TILES_X), TILE * TILES_X), dtype=np.uint8)
for z in range(SIZE):
    row, col = divmod(z, TILES_X)
    tile = np.pad((volume[:, :, z].T * 255).astype(np.uint8), 1, mode="wrap")
    atlas[row * TILE:(row + 1) * TILE, col * TILE:(col + 1) * TILE] = tile
Image.fromarray(atlas).save(sys.argv[1], optimize=True)
