# Seed audit: MousePartsVisualizer `seed-mice-export.json`

**Source:** `f:\Backup\Ramsta E\Coding Projects\MousePartsVisualizer\seed-mice-export.json`  
**Exported:** 2026-05-14 · **306 mice** · notes mostly `"TPU review data"`  
**Audited:** 2026-07-19  
**Policy:** Do **not** blindly merge into our catalog. Only import fields that pass structural checks **and** can be re-sourced (TPU/OEM/RTINGS URL).

---

## Verdict

DeepSeek’s project shipped **volume** (306 models) and several technician-facing features we should steal. The seed itself is **not trustworthy as-is**: broken parsers hallucinated colors as switch brands, truncated encoder names, omitted MCUs and citations, and at least one high-profile model is **mis-keyed**.

| Bucket | Count | Meaning |
| --- | ---: | --- |
| Structurally sane candidates | ~200 | Switch/encoder strings look like real part names (still need URL re-verify before merge) |
| Switch parse garbage | ~25–40 | e.g. `brand: "blue", model: "shell"` |
| Encoder truncated (`F` / `CF`) | ~46 | Almost certainly `F-Switch` / similar mangled by `(\w+)` |
| MCU present | **0 / 306** | Spec table MCU column never scraped |
| Per-row source URL | **0 / 306** | No provenance — violates our accuracy policy |

---

## Root causes (in their `scripts/tpu-bulk-import.mjs`)

1. **`parseSwitch()`** splits TPU prose on first words. Lines like *“Huano blue transparent shell…”* become `{ brand: "blue", model: "shell" }`.
2. **`scrapeEncoderDetails()`** uses `/encoder comes from (\w+)/` — only one word, so **F-Switch → `F`**, and similar truncations → **`CF`**.
3. Specs scrape never reads **Microcontroller Unit**.
4. Export has **no review URL** per mouse — only a blanket note.
5. `dataCompleteness` is ~60 for almost everything — not a real completeness metric.

**Note:** `Huano` + `Blue Shell Pink Dot` (and similar) is a **real** switch naming convention used by TPU and modders. That is **not** garbage. Garbage is when the **brand itself** is a color (`blue`, `green`, `pink`).

---

## Spot-checks vs TechPowerUp (known-good)

| Seed id | Seed claim | Reality (TPU) | Result |
| --- | --- | --- | --- |
| `logitech-gpro-x-superlight-2` | Switches: Lightforce Hybrid · Encoder: **Kailh 9mm** · Sensor: Hero 2 | Main: **Omron D2FP-FH1 (China)** (marketed as LIGHTFORCE) · Encoder: **TTC Silver, 8 mm** · Sensor: **HERO 2** · MCU: **nRF52840** | Encoder **wrong**; switches OK as marketing name / weaker than part number |
| `logitech-g-pro-x-superlight` | Omron D2FP-FH1 · TTC 9 · **HERO 2** | That part set is **Superlight 2**, not original Superlight (original uses older HERO + different switches) | **Mis-keyed / wrong model** |
| `hyperx-pulsefire-haste-2` | HyperX Switch · TTC 10 · HyperX 26K | TPU: HyperX Switch (100 M) · TTC silver 10 mm · HyperX 26K (PAW3395) | **OK** (sensor brand labeling soft) |
| `hyperx-pulsefire-haste` | TTC Golden Micro Dustproof · PAW3335 | Matches original Haste TPU table | **OK** |
| `razer-viper-v3-pro` | Razer Optical Gen-3 · TTC 8 · Pro 35K | Matches TPU (sensor = Focus Pro 35K / PixArt) | **OK** (naming variant) |
| `lamzu-atlantis-mini` | Switches: **blue / shell** · TTC 8 · PAW3395 | Switch field is parser garbage; sensor/encoder plausible | **Reject switch**; re-scrape |
| `zowie-ec2-c` | Huano Blue Shell Blue Dot · Alps 9 optical · PAW3360 | Huano color-name is valid convention | **Likely OK** pending URL |
| `zowie-ec3-c` | Huano/Huano · Unknown encoder · PMW3360 | Weak switch model; encoder empty | **Caution** |

Our catalog already matches TPU on GPX2 (Omron D2FP-FH1 + TTC Silver 8 mm + HERO 2 + nRF52840) and Pulsefire Haste 2 — **keep ours**, do not overwrite from seed.

---

## What their project includes (feature map)

Worth porting into *our* extension/website (accuracy-first):

| Feature | Path | Steal? |
| --- | --- | --- |
| Gold standards reference (switch/encoder/sensor/MCU explainers) | `src/shared/gold-standards.ts` | **Yes** — great for techs |
| Known failure modes + replacement shop links | `src/shared/known-failures.ts`, `ReplacementShop.tsx` | **Yes** |
| Double-click checker | `DoubleClickChecker.tsx` | **Yes** — technician utility |
| Scroll-wheel checker | `ScrollWheelChecker.tsx` | **Yes** |
| Page product detector / overlay | `content/detector.ts`, `overlay.tsx` | Maybe (we have selection + OCR already) |
| Contribute form + Supabase sync | `ContributeForm`, `supabase-sync.ts` | Later (we have community votes + Vercel API) |
| Bulk TPU crawl volume | `tpu-bulk-import.mjs` | **Yes idea, no — their parser** — rebuild with our polite scrapers + citations |

What we already beat them on:

- Sourced fields + conflict notes (OEM / RTINGS / curated TPU)
- MCU field populated where known
- Hosted API + Vercel path
- In-page region OCR
- Explicit “unknown stays unknown” policy

---

## Import rules (if/when we merge)

1. **Never** import `brand` ∈ `{blue,green,pink,white,red,yellow,shell,…}` as a switch brand.
2. **Never** import encoder brand ∈ `{F, CF}` without expanding to a verified name (usually F-Switch).
3. **Never** import a row without a concrete source URL (construct/verify TPU review URL, then re-parse with *our* parser).
4. Prefer **part numbers** (Omron D2FP-FH1) over marketing names (LIGHTFORCE) when both appear; note marketing name in `notes`.
5. On id collision with our catalog: **ours wins** unless seed has a cited field we lack and it re-verifies.

---

## Recommended next steps

1. Keep this audit as the gate; do not dump 306 rows into `mice.json`.
2. Port technician tools (gold standards, known failures, double-click + scroll checkers) into the extension UI.
3. Re-run a **fixed** TPU import (or offline `--from-html`) through our scraper merge pipeline with citations.
4. Optionally seed from the ~200 structurally sane IDs **only after** URL re-fetch validates each field.
