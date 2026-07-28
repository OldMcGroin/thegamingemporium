# Social preview safeguard

The site has one canonical default social preview image:

- Source image: `static/share-preview.jpg`
- Public URL: `https://thegamingemporium.com/share-preview.jpg`
- Metadata partial: `layouts/partials/social-meta.html`
- Template include: `{{ partial "social-meta.html" . }}` in `layouts/_default/baseof.html`

Run this at any time:

```bash
./check-social
```

The same check runs automatically before preview, build and deploy.

## What the check validates

It checks only the configuration that can affect the live homepage preview:

- `static/share-preview.jpg` exists;
- `baseof.html` includes `social-meta.html` exactly once;
- social metadata is not duplicated inline in `baseof.html`;
- the default image URL is exactly `https://thegamingemporium.com/share-preview.jpg`;
- required Open Graph and Twitter image tags exist;
- the old `/Images/Social/share-preview...` URL is not used by the metadata;
- when Pillow is installed, the file is a real JPEG and its declared width/height match the actual image.

## What the check deliberately ignores

It does **not** scan or block:

- `public/` or `resources/` generated output;
- unrelated screenshots;
- old images stored outside the live metadata path;
- filenames that are not referenced by the homepage social metadata.

This keeps the safeguard focused on preventing a broken Facebook, Reddit, Discord or messaging-app preview without interrupting builds for unrelated files.

## Updating the preview image

Overwrite:

```text
static/share-preview.jpg
```

Keep the filename and public URL unchanged. If the new JPEG has different dimensions, update the default `$ogImageW` and `$ogImageH` values in `layouts/partials/social-meta.html`. Then run:

```bash
./check-social
```

## No third-party Python packages required

The checker now uses only Python's standard library. It validates the JPEG and reads its dimensions directly, so Pillow is not required and no `Pillow not installed` message should appear.
