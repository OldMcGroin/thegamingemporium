#!/usr/bin/env python3
"""Validate the site's social-preview configuration using only Python's standard library."""

from __future__ import annotations

import re
import struct
import sys
from pathlib import Path

EXPECTED_URL = "https://thegamingemporium.com/share-preview-july-2026.jpg"
EXPECTED_IMAGE = Path("static/share-preview-july-2026.jpg")
BASEOF = Path("layouts/_default/baseof.html")
SOCIAL_META = Path("layouts/partials/social-meta.html")

REQUIRED_SNIPPETS = (
    'property="og:image"',
    'property="og:image:secure_url"',
    'property="og:image:type"',
    'property="og:image:width"',
    'property="og:image:height"',
    'name="twitter:image"',
)


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def jpeg_dimensions(path: Path) -> tuple[int, int]:
    """Return JPEG width and height without Pillow or any other dependency."""
    data = path.read_bytes()
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        fail(f"{path} is not a valid JPEG file.")

    sof_markers = {
        0xC0, 0xC1, 0xC2, 0xC3,
        0xC5, 0xC6, 0xC7,
        0xC9, 0xCA, 0xCB,
        0xCD, 0xCE, 0xCF,
    }

    offset = 2
    while offset < len(data):
        if data[offset] != 0xFF:
            offset += 1
            continue

        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            break

        marker = data[offset]
        offset += 1

        if marker in {0x01, *range(0xD0, 0xD9)}:
            continue

        if offset + 2 > len(data):
            break

        segment_length = struct.unpack(">H", data[offset:offset + 2])[0]
        if segment_length < 2 or offset + segment_length > len(data):
            fail(f"{path} contains an invalid JPEG segment.")

        if marker in sof_markers:
            if segment_length < 7:
                fail(f"{path} contains an invalid JPEG size segment.")
            height = struct.unpack(">H", data[offset + 3:offset + 5])[0]
            width = struct.unpack(">H", data[offset + 5:offset + 7])[0]
            return width, height

        offset += segment_length

    fail(f"Could not determine JPEG dimensions for {path}.")
    raise AssertionError("unreachable")


def declared_dimension(text: str, variable: str) -> int:
    match = re.search(
        rf'\{{\{{\s*\${re.escape(variable)}\s*:=\s*"(\d+)"\s*\}}\}}',
        text,
    )
    if not match:
        fail(f"Could not find the declared ${variable} value in {SOCIAL_META}.")
    return int(match.group(1))


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    image = root / EXPECTED_IMAGE
    baseof_file = root / BASEOF
    social_file = root / SOCIAL_META

    if not image.is_file():
        fail(f"Required root image is missing: {EXPECTED_IMAGE}")
    print(f"✓ Root image exists: {EXPECTED_IMAGE}")

    if not baseof_file.is_file():
        fail(f"Missing template: {BASEOF}")
    baseof = baseof_file.read_text(encoding="utf-8")

    include_count = len(re.findall(
        r'\{\{\s*partial\s+["\']social-meta\.html["\']\s+\.\s*\}\}',
        baseof,
    ))
    if include_count != 1:
        fail(f"{BASEOF} must include social-meta.html exactly once; found {include_count}.")
    print("✓ baseof.html includes social-meta.html exactly once")

    if not social_file.is_file():
        fail(f"Missing partial: {SOCIAL_META}")
    social = social_file.read_text(encoding="utf-8")
    print("✓ social-meta.html exists")

    if EXPECTED_URL not in social:
        fail(f"Default preview URL is incorrect. Expected: {EXPECTED_URL}")
    print(f"✓ Default preview URL is correct: {EXPECTED_URL}")

    for snippet in REQUIRED_SNIPPETS:
        if snippet not in social:
            fail(f"Required social metadata tag is missing: {snippet}")
    print("✓ Required Open Graph and Twitter tags are present")

    # Scan source only. Generated public/ output and unrelated image files are ignored.
    obsolete = "/images/social/share-preview"
    offenders: list[str] = []
    for source_dir_name in ("layouts", "content", "data"):
        source_dir = root / source_dir_name
        if not source_dir.exists():
            continue
        for file in source_dir.rglob("*"):
            if not file.is_file():
                continue
            try:
                contents = file.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            if obsolete in contents.lower():
                offenders.append(str(file.relative_to(root)))

    if offenders:
        fail(
            "Obsolete /Images/Social/share-preview reference found in source:\n  "
            + "\n  ".join(sorted(set(offenders)))
        )
    print("✓ No obsolete /Images/Social/share-preview source references found")

    width, height = jpeg_dimensions(image)
    declared_width = declared_dimension(social, "ogImageW")
    declared_height = declared_dimension(social, "ogImageH")

    if (width, height) != (declared_width, declared_height):
        fail(
            "JPEG dimensions do not match the Open Graph metadata.\n"
            f"Image: {width}x{height}\n"
            f"Declared: {declared_width}x{declared_height}"
        )

    print(f"✓ Preview image is a valid JPEG ({width}x{height})")
    print("✓ Declared Open Graph dimensions match the image")
    print("Social preview check passed.")


if __name__ == "__main__":
    main()
