#!/usr/bin/env python3
"""Convert BLP2 DXT or palette icon textures to a browser-convertible image."""

from __future__ import annotations

import struct
import sys
from pathlib import Path


def main() -> None:
    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    data = source.read_bytes()
    if data[:4] != b"BLP2":
        raise SystemExit(f"Unsupported BLP format: {source}")

    width, height = struct.unpack_from("<II", data, 12)
    offset = struct.unpack_from("<I", data, 20)[0]
    length = struct.unpack_from("<I", data, 84)[0]
    payload = data[offset : offset + length]
    encoding, alpha_depth, alpha_encoding = data[8:11]

    if encoding == 1 and alpha_depth == 0:
        palette = data[148 : 148 + 1024]
        indexes = payload[: width * height]
        pixels = bytearray()
        for palette_index in indexes:
            blue, green, red, _ = palette[palette_index * 4 : palette_index * 4 + 4]
            pixels.extend((red, green, blue))
        destination.write_bytes(f"P6\n{width} {height}\n255\n".encode() + pixels)
        return

    if encoding != 2 or alpha_encoding not in (0, 1):
        raise SystemExit(f"Unsupported BLP format: {source}")

    fourcc = b"DXT5" if alpha_depth == 8 else b"DXT1"
    header = struct.pack(
        "<I6I11I2I4s10I",
        124, 0x00081007, height, width, len(payload), 1, 0,
        *([0] * 11), 32, 0x00000004, fourcc, *([0] * 10),
    )
    destination.write_bytes(b"DDS " + header + payload)


if __name__ == "__main__":
    main()
