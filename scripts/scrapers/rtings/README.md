# RTINGS mouse importer

Respects `robots.txt` (product/review pages are allowed; `/user_reviews/` and `/admin/` are not).

RTINGS detailed lab matrices are often client-rendered / membership-gated. This scraper only uses **free page identity + introduction/meta text** for clearly stated sensor/switch phrases, always with a citation URL.

```bash
npm install
npm run scrape -w @mouse-parts/scraper-rtings -- --limit 40 --merge --only-existing
```
