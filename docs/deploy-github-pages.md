# Deploy: GitHub Pages (manual)

No Cloudflare credentials were available, so the free path is GitHub Pages with a **manual** workflow. Nothing publishes on push.

1. Repository → Settings → Pages → Source: **GitHub Actions**. (Pages on a private repository needs a paid plan; make the repository public first, after the audit.)
2. Actions → **Deploy static site to GitHub Pages** → Run workflow.
3. The workflow runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build:pages`, then deploys `dist-pages/`.

Static hosting has no response headers, so the CSP is a `<meta>` tag in `index.html`. All state stays in the visitor's browser.
