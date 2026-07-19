# Manufacturer (OEM) product-page scraper

Allowlisted hosts only. Checks each host’s `robots.txt` before fetch.

Parses structured specs where available:

- **Logitech G** — `inRiverTechSpecs` (Sensor, Button Technology, Microprocessor)
- **Razer** — classification `featureValues` (Sensor, Switches)
- **Others** — conservative JSON-LD / labeled rows

```bash
npm run scrape -w @mouse-parts/scraper-oem -- --merge
```

Edit targets in [`data/scrapers/oem-urls.json`](../../../data/scrapers/oem-urls.json).
