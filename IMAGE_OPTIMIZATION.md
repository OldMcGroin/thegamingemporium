# Image optimisation (fast + Steam Deck friendly)

This site automatically prefers images in this order:

1. `.webp`
2. `.jpg`
3. `.png`

So the easiest way to speed up the site is to generate WebP versions of your images.
No template changes needed.

## Bulk convert images to WebP

A helper script is included:

```bash
./tools/optimize_images.sh
```

### Install ImageMagick

Steam Deck (Desktop Mode):

```bash
sudo pacman -S imagemagick
```

### Options

- Change WebP quality (default 85):

```bash
QUALITY=82 ./tools/optimize_images.sh
```

- Delete originals after converting:

```bash
KEEP_ORIGINALS=0 ./tools/optimize_images.sh
```

## Where to place images

- Home cards: `static/Images/Home/`
- Category cards: `static/Images/Categories/`
- Genre cards: `static/Images/Genres/`
- Series cards: `static/Images/Series/`
- Game cards: `static/Images/Games/`

(Exact folder casing matters: `Images`, not `images`.)
