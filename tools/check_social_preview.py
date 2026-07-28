#!/usr/bin/env python3
"""Fail a build if the known-good social preview setup is accidentally changed."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
partial = ROOT / "layouts" / "partials" / "social-meta.html"
baseof = ROOT / "layouts" / "_default" / "baseof.html"
image = ROOT / "static" / "share-preview.jpg"
expected_url = "https://thegamingemporium.com/share-preview.jpg"

errors = []

if not partial.is_file():
    errors.append(f"Missing {partial.relative_to(ROOT)}")
else:
    text = partial.read_text(encoding="utf-8")
    required = [
        expected_url,
        'property="og:image"',
        'property="og:image:secure_url"',
        'property="og:image:type"',
        'property="og:image:width"',
        'property="og:image:height"',
        'name="twitter:image"',
    ]
    for item in required:
        if item not in text:
            errors.append(f"social-meta.html is missing: {item}")
    if "/Images/Social/share-preview" in text:
        errors.append("social-meta.html has reverted to the unreliable /Images/Social preview path")

if not baseof.is_file():
    errors.append(f"Missing {baseof.relative_to(ROOT)}")
else:
    text = baseof.read_text(encoding="utf-8")
    if '{{ partial "social-meta.html" . }}' not in text:
        errors.append('baseof.html is not calling partial "social-meta.html"')

if not image.is_file():
    errors.append(f"Missing {image.relative_to(ROOT)}")
else:
    try:
        from PIL import Image
        with Image.open(image) as im:
            if im.format != "JPEG":
                errors.append(f"{image.name} must be JPEG, found {im.format}")
            if im.size != (1178, 563):
                errors.append(f"{image.name} must be 1178x563, found {im.size[0]}x{im.size[1]}")
    except ImportError:
        # Pillow is optional on the user's machine; existence is still checked.
        pass
    except Exception as exc:
        errors.append(f"Could not validate {image.name}: {exc}")

# Prevent old or duplicate preview images from returning in future builds.
legacy_files = [
    ROOT / "static" / "share-preview-v3.jpg",
    ROOT / "static" / "Images" / "Social" / "share-preview.jpg",
    ROOT / "static" / "Images" / "Social" / "share-preview.webp",
    ROOT / "static" / "Images" / "Social" / "share-preview-v2.jpg",
]
for legacy in legacy_files:
    if legacy.exists():
        errors.append(f"Remove obsolete social preview file: {legacy.relative_to(ROOT)}")

root_previews = sorted((ROOT / "static").glob("share-preview*"))
allowed = [image]
if root_previews != allowed:
    found = ", ".join(str(p.relative_to(ROOT)) for p in root_previews) or "none"
    errors.append(f"Only static/share-preview.jpg is allowed; found: {found}")

if errors:
    print("ERROR: Social preview safeguard failed:", file=sys.stderr)
    for error in errors:
        print(f"  - {error}", file=sys.stderr)
    sys.exit(1)

print(f"Social preview check passed: {expected_url}")
