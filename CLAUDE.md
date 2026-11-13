# Working in this repo

## Deploy workflow: test first, then main

The site deploys from Cloudflare Pages:

| Branch | Address | Purpose |
|---|---|---|
| `main` | https://jonathanrainey.dev | Live site |
| `test` | https://test.jonathanrainey.dev (also https://test.portfoliopage2.pages.dev) | Test copy for checking changes on a phone before they go live |

Rules:

- **"Push to test"** means: commit the changes to the `test` branch and push it. Before committing, bring `test` up to date with `main` (merge `origin/main` into `test`) so the test site matches live plus the new changes. After pushing, wait for the Cloudflare Pages check on the commit to finish and report the result and the test address.
- **"Push to main"** means: merge `test` into `main` (fast-forward when possible) and push `main`. Only do this when Jonathan explicitly says so.
- Never push directly to `main` without that instruction, even for small fixes.
- Feature branches are fine for work in progress, but changes reach `main` only through `test`.

## Project layout

- `frontend/` is a Create React App project (`npm start`, `npm test`, `npm run build`).
- `frontend/functions/` holds Cloudflare Pages Functions (same-origin proxies for ESPN and nflverse). `functions/` at the repo root re-exports them.
- `frontend/src/setupProxy.js` serves the same proxy paths under `npm start`.
