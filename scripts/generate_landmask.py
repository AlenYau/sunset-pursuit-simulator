"""Rasterize Natural Earth 1:50m land polygons into a compact globe mask."""
import json
import sys
from PIL import Image, ImageDraw, ImageFilter

WIDTH, HEIGHT = 4096, 2048

def xy(ring):
    return [((lon + 180) / 360 * (WIDTH - 1), (90 - lat) / 180 * (HEIGHT - 1)) for lon, lat in ring]

with open(sys.argv[1], encoding="utf-8") as source:
    features = json.load(source)["features"]

mask = Image.new("L", (WIDTH, HEIGHT), 0)
draw = ImageDraw.Draw(mask)
for feature in features:
    geometry = feature["geometry"]
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    for polygon in polygons:
        draw.polygon(xy(polygon[0]), fill=255)
        for hole in polygon[1:]:
            draw.polygon(xy(hole), fill=0)

mask = mask.filter(ImageFilter.GaussianBlur(1.25))
mask.save(sys.argv[2], optimize=True)
