#!/usr/bin/env python3
"""Convert extracted BLP card icons into local WebP assets and update the pool."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
EXTRACTED = Path("/tmp/opencode/card-icons")
TEMP = Path("/tmp/opencode/card-icon-dds")
ASSETS = ROOT / "public/icons"
POOL = ROOT / "data/darkmoon-card-pool.json"
CONVERTER = ROOT / "scripts/blp_to_dds.py"


def asset_name(icon: str) -> str:
    return icon.replace("\\", "-").replace("/", "-").lower() + ".webp"


def main() -> None:
    cards = json.loads(POOL.read_text(encoding="utf-8"))
    icons = {card["icon"] for card in cards["records"]}
    TEMP.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    converted = 0

    for icon in icons:
        source = EXTRACTED / (icon.replace("\\", "-").replace("/", "-") + ".blp")
        output = ASSETS / asset_name(icon)
        if not source.exists():
            continue
        if not output.exists():
            intermediate = TEMP / (output.stem + ".ppm")
            result = subprocess.run(["python3", str(CONVERTER), str(source), str(intermediate)], capture_output=True)
            if result.returncode == 0:
                subprocess.run(["magick", str(intermediate), "-resize", "64x64", str(output)], check=True)
                converted += 1

    for card in cards["records"]:
        output = ASSETS / asset_name(card["icon"])
        card["iconUrl"] = f"icons/{output.name}" if output.exists() else None

    POOL.write_text(json.dumps(cards, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {converted} WebP icons.")


if __name__ == "__main__":
    main()
