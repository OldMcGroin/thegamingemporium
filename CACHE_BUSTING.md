# Automatic CSS and JavaScript cache busting

The site now uses Hugo Pipes to minify and fingerprint the main stylesheet and all hand-written JavaScript files.

Each build generates filenames containing a content hash, for example:

- `/css/main.min.abc123.css`
- `/js/suggestions.min.def456.js`

When a file changes, its URL changes automatically, so browsers and Cloudflare fetch the new version instead of serving an older cached copy.

The generated data files `games-slug-map.js` and `search-index.js` retain build-time query-string versioning because they are generated into `static/` by the existing Python tools.
