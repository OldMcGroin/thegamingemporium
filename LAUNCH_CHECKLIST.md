Launch checklist (Netlify + Cloudflare)

1) Clean build locally
- From the site root (the folder containing config.toml), run:
  hugo --minify
- Then:
  hugo server --disableFastRender --noHTTPCache

2) Dev-only buttons
- Shuffle / Copy buttons are wrapped in `hugo.IsServer`, so they show only when running `hugo server` locally.
- They will NOT appear on Netlify/production builds.

3) Netlify deploy
- Drag & drop the `sitecat` folder into Netlify is NOT recommended.
  Prefer:
  - create a Git repo and connect Netlify to it, OR
  - drag & drop the generated `public/` folder after `hugo --minify`.
- Typical Netlify settings:
  Build command: hugo --minify
  Publish directory: public
  Hugo version: set in Netlify env (or netlify.toml) if needed.

4) Cloudflare Web Analytics
- Put your token in config.toml:
  [params]
  cloudflare_web_analytics_token = "YOUR_TOKEN_HERE"

5) Domain
- Point your domain DNS to Netlify (or put Cloudflare in front and CNAME to Netlify).
- Enable HTTPS (Netlify handles this).

6) Quick smoke test
- Home page loads quickly
- Cards render + search works
- Random home images work
- Mobile shows HomeMobile images (<=700px width)
