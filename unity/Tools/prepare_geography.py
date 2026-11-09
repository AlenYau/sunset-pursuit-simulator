"""Flatten nested source polygons into arrays Unity JsonUtility can deserialize.

Run from the repository root: python3 unity/Tools/prepare_geography.py
"""
import ast
import json
import pathlib
import re

here = pathlib.Path(__file__).resolve()
root = here.parents[2]
if not (root / "src/geography.ts").exists():
    root = here.parents[2] / "sunset-pursuit-open-source"
source = json.loads((root / "public/geography.json").read_text())
code = (root / "src/geography.ts").read_text()
names_block = code.split("const seaNames:", 1)[1].split("};", 1)[0]
pairs = re.findall(r"('(?:\\.|[^'\\])*')\s*:\s*('(?:\\.|[^'\\])*')", names_block)
sea_names = {ast.literal_eval(k): ast.literal_eval(v) for k, v in pairs}


def flatten(piece):
    vertices = []
    offsets = [0]
    for ring in piece["r"]:
        for lon, lat in ring:
            vertices.extend((lon, lat))
        offsets.append(len(vertices) // 2)
    return {"b": piece["b"], "v": vertices, "o": offsets}


result = {
    "countries": [
        {"n": c["n"], "iso": c["iso"], "p": [flatten(p) for p in c["p"]]}
        for c in source["countries"]
    ],
    "seas": [
        {"n": sea_names.get(s["e"], s["e"]), "a": s["a"], "p": [flatten(p) for p in s["p"]]}
        for s in source["seas"]
    ],
}
target = here.parents[1] / "Assets/Resources/geography.json"
target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
print(f"Wrote {target} ({len(result['countries'])} countries, {len(result['seas'])} seas)")
