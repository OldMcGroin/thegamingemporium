#!/usr/bin/env bash
set -euo pipefail

# Bulk image optimizer for this Hugo site.
#
# Generates WebP files alongside existing JPG/JPEG/PNG files under static/Images.
# The site will automatically use the WebP versions (preferred) without any template changes.
#
# Requirements:
#   - ImageMagick (magick)
#   Steam Deck (Desktop Mode): sudo pacman -S imagemagick
#
# Usage:
#   ./tools/optimize_images.sh            # convert + resize
#   KEEP_ORIGINALS=0 ./tools/optimize_images.sh  # delete .jpg/.png after webp created
#   QUALITY=82 ./tools/optimize_images.sh        # adjust webp quality
#
# Defaults are tuned for fast scrolling on Steam Deck.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMG_DIR="$ROOT_DIR/static/Images"

QUALITY="${QUALITY:-85}"
# Resize only if image is larger than these maximums (keeps aspect ratio).
MAX_GAME="${MAX_GAME:-900x900>}"     # Games + Series artwork
MAX_TILE="${MAX_TILE:-1400x1400>}"   # Home/Categories/Genres tiles (wider OK)
KEEP_ORIGINALS="${KEEP_ORIGINALS:-1}"

if ! command -v magick >/dev/null 2>&1; then
  echo "ERROR: ImageMagick not found. Install it first. (Steam Deck: sudo pacman -S imagemagick)" >&2
  exit 1
fi

# Decide resize target per folder
resize_for_file() {
  local path="$1"
  case "$path" in
    */Images/Games/*|*/Images/Series/*)
      echo "$MAX_GAME"
      ;;
    */Images/Home/*|*/Images/Categories/*|*/Images/Genres/*)
      echo "$MAX_TILE"
      ;;
    *)
      echo "$MAX_TILE"
      ;;
  esac
}

shopt -s nullglob
mapfile -t files < <(find "$IMG_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \))

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No .jpg/.jpeg/.png files found under $IMG_DIR"
  exit 0
fi

echo "Found ${#files[@]} images to convert under $IMG_DIR"

for src in "${files[@]}"; do
  base_no_ext="${src%.*}"
  out="${base_no_ext}.webp"

  # Skip if webp already exists
  if [[ -f "$out" ]]; then
    continue
  fi

  resize_spec="$(resize_for_file "$src")"

  # Convert + resize (only shrinks if bigger than MAX_...)
  magick "$src" -resize "$resize_spec" -quality "$QUALITY" "$out"
  echo "Created: ${out#$ROOT_DIR/}"

done

if [[ "$KEEP_ORIGINALS" == "0" ]]; then
  echo "Deleting original JPG/PNG files (KEEP_ORIGINALS=0) ..."
  find "$IMG_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) -delete
fi

echo "Done. Your site will automatically prefer .webp versions where available."
