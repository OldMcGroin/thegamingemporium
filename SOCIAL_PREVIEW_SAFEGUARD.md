# Social preview safeguard

The site uses exactly one default social preview image:

- Source file: `static/share-preview.jpg`
- Public URL: `https://thegamingemporium.com/share-preview.jpg`
- Metadata partial: `layouts/partials/social-meta.html`
- Image dimensions: `1178x563` JPEG

Old and duplicate files under `static/Images/Social/`, plus versioned root files such as `static/share-preview-v3.jpg`, have been removed deliberately. Do not restore them.

`baseof.html` includes the metadata using:

```go
{{ partial "social-meta.html" . }}
```

The build, preview and deploy scripts run `tools/check_social_preview.py`. The check stops the build if:

- `static/share-preview.jpg` is missing or replaced with another format or size;
- the metadata points anywhere except the root URL;
- duplicate or obsolete social-preview files return;
- required Open Graph or Twitter image tags are removed.

When updating the image in future, overwrite `static/share-preview.jpg` with the intended JPEG and update the dimensions in `social-meta.html` and `check_social_preview.py` only if the dimensions change. Do not create extra preview filenames or copies under `static/Images/Social/`.
