# Mouse Parts Lookup

Browser extension + Vercel API for mouse repair technicians. Look up **sourced, verifiable** parts (switches, encoders, sensors, MCUs) by brand/model — unknown fields stay blank.

Desktop website (same Vercel app) comes **after** the extension MVP.

## Principles

- Accuracy over completeness
- Every filled field cites a source
- Community Up/Down votes are signals only — they never rewrite catalog data
- OCR / page scan only produce search queries, never part facts

## Monorepo

```
apps/web          Vercel Next.js API (+ future website)
apps/extension    Chrome MV3 extension
packages/shared   Shared TypeScript types
data/catalog      Sourced mouse catalog JSON
docs/PRD.md       Product requirements
```

## Setup

```bash
npm install
node scripts/generate-icons.mjs
```

### API (local)

```bash
npm run dev:api
```

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

Optional persistent votes: copy `apps/web/.env.example` → `apps/web/.env.local` and add Upstash Redis credentials.

### Extension

```bash
npm run build:extension
```

Then in Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select `apps/extension/dist`.

Default API base is `http://localhost:3000`. After you deploy the API to Vercel, set it in the extension via DevTools on the service worker / storage:

```js
chrome.storage.sync.set({ apiBase: "https://your-deployment.vercel.app" })
```

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Status |
| GET | `/api/search?q=` | Search catalog |
| GET | `/api/models/:id` | Model detail + votes |
| GET/POST | `/api/votes` | Read / cast Up-Down |
| GET | `/api/community` | Models with votes |

## Deploy API to Vercel

1. Import this repo in Vercel
2. Set **Root Directory** to `apps/web`
3. Add Upstash env vars for production votes
4. Deploy, then point the extension `apiBase` at the deployment URL

## Catalog policy

See [`data/catalog/mice.json`](./data/catalog/mice.json). Do not add part values without a citation URL. Niche brands are welcome with blank parts until sourced.

## Docs

- [PRD](./docs/PRD.md)
