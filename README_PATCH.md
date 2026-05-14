# Facilities Command Center — S-tier Blue Patch

Replace these files in your `v2-rebuild` branch:

- `index.html`
- `command-center.html`
- `styles.css`
- `service-worker.js`
- `manifest.json`

Keep your existing `config.js` in place. This patch includes `config.example.js` only so your real Supabase values are not overwritten.

Also keep/copy the included icons:

- `icon-192.png`
- `icon-512.png`
- `apple-touch-icon.png`

After replacing the files:

1. Open the app locally.
2. Hard refresh the browser.
3. If the old style still appears, unregister the old service worker or clear site data once.
4. Commit to your `v2-rebuild` branch.

This patch preserves the existing app.js engine and focuses on the blue premium command-center shell.
