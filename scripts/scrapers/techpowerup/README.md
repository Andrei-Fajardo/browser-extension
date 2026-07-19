# TechPowerUp importer

Parses TechPowerUp **mouse review specification tables** into our catalog schema (switches, encoder, sensor, MCU) with citation URLs.

## Legal / ToS (read this)

TechPowerUp states that **automated scraping / data mining is prohibited without prior written permission**. See their `robots.txt` site notice and contact `w1zzard@techpowerup.com`.

This tool therefore:

1. **Defaults to offline mode** (`--from-html`) — you manually save a review page and import it.
2. **Gates live HTTP fetch** behind `TPU_I_HAVE_PERMISSION=1` (only after you have written permission).

Do **not** run bulk `--list` / crawl loops against their servers without that permission.

## Setup

```bash
cd scripts/scrapers/techpowerup
npm install
```

## Offline import (recommended)

1. Open a review, e.g. https://www.techpowerup.com/review/hyperx-pulsefire-haste-2/
2. Save page as HTML
3. Import:

```bash
node src/cli.js --from-html ./saved/haste-2.html \
  --source-url https://www.techpowerup.com/review/hyperx-pulsefire-haste-2/ \
  --merge --save-raw
```

## Live fetch (permission required)

```bash
# Only after written permission from TechPowerUp
set TPU_I_HAVE_PERMISSION=1
node src/cli.js --url https://www.techpowerup.com/review/hyperx-pulsefire-haste-2/ --merge
```

## Mapped fields

| TPU row | Catalog field |
|---------|----------------|
| Main Switches | `mainSwitches` |
| Side Switches | `sideSwitches` (rare) |
| Wheel Encoder | `encoder` |
| Sensor | `sensor` |
| Microcontroller Unit | `mcu` |

Missing rows stay `Unknown`. Conflicting values are not overwritten; the alternate is recorded on the existing field’s sources/notes.
