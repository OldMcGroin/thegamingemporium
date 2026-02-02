# Cloudflare Web Analytics

This Hugo site supports Cloudflare Web Analytics.

## Enable it

1. In your Cloudflare dashboard, open **Web Analytics** and **Add a site**.
2. Copy the **Site token**.
3. Set the token using *one* of the options below.

### Option A (recommended): Environment variable

When running locally:

```bash
export CLOUDFLARE_WEB_ANALYTICS_TOKEN="YOUR_TOKEN_HERE"
hugo server
```

When building for Netlify, set an environment variable named `CLOUDFLARE_WEB_ANALYTICS_TOKEN` in your Netlify site settings.

### Option B: config.toml

Edit `config.toml`:

```toml
[params]
  cloudflare_web_analytics_token = "YOUR_TOKEN_HERE"
```

## Notes

- If the token is empty, the analytics script is **not** rendered.
- The script is injected just before the closing `</body>` tag (as recommended by Cloudflare).
