GAME CARD IMAGES

Where to put them:
  sitecat/static/Images/Games/

How the site finds them:
  - Each game title is converted to a "slug" (lowercase, spaces -> hyphens, punctuation removed).
  - The templates look for these files (in this exact order):
      <slug>.webp
      <slug>.jpg
      <slug>.png
  - If none exist, it shows: /Images/placeholder.jpg

Example:
  Title:  Advance Wars Returns
  Slug:   advance-wars-returns
  Files:  advance-wars-returns.webp  (preferred)
          advance-wars-returns.jpg
          advance-wars-returns.png

Easy way to get the slug (recommended):
  When running locally with:
    hugo server
  the game cards show a small "Copy filename" button.
  Click it to copy the slug to your clipboard, then name your image file:
    <copied-slug>.jpg  (or .webp/.png)

Tips:
  - Use square-ish images when possible.
  - Keep images <= ~900px wide for fast scrolling.
  - If you have ImageMagick installed, you can auto-convert/resize images to WebP:
      cd sitecat
      ./tools/optimize_images.sh
