# Product Requirements Document (PRD)

**Product:** Mouse Parts Lookup — Browser Extension  
**Repository:** https://github.com/Andrei-Fajardo/browser-extension  
**Status:** Draft v0.2  
**Last updated:** 2026-07-19  
**Owner:** Andrei Fajardo  

---

## 0. Decisions Log (resolved)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Brand coverage | **Mainstream + niche** — do not limit the catalog to large OEMs. Include boutique / lesser-known brands when sourced. |
| D2 | In-page lookup | **Text selection + image region (OCR)** for MVP. |
| D3 | Data delivery | **Small hosted API on Vercel** (not hard; same platform as the future website). Extension reads from API. |
| D4 | Veracity signal | **Community tab** with **thumbs up / thumbs down** per model (and later per field) to gauge trust. |
| D5 | Website | **Desktop website on Vercel after the extension MVP.** Shared API + catalog; marketing/search UI comes next. |

---

## 1. Problem Statement

Mouse repair technicians must identify compatible replacement parts across hundreds of mouse models. Parts are not interchangeable by brand alone: encoders, switches, sensors, and MCUs vary by model, revision, and sometimes by production batch.

Today, technicians rely on fragmented sources (forums, teardown blogs, datasheets, Reddit, manufacturer pages). Searching is slow, results are inconsistent, and unverified “tribal knowledge” often mixes with facts.

**Goal:** A browser extension that streamlines discovery of **sourced, verifiable** mouse-part information—never fabricated specs—so technicians can work faster without trusting hallucinated data.

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. Let a technician type a brand, model, or common name (e.g. “Pulsefire”, “Logitech G Pro X Superlight”, “Razer”) and see structured part info when available.
2. Support **search-within-page** (Lens-like): select or capture text/images on the current tab and resolve them against the parts knowledge base + verified web sources.
3. Prefer **accuracy and provenance** over completeness. Missing data is shown as blank/unknown, not guessed.
4. Use **web scraping / structured fetch** from allowlisted sources to fill gaps, with clear citations.
5. Ship a maintainable Chrome/Chromium MV3 extension suitable for public use and open contribution.

### 2.2 Non-Goals (v1)

- Selling parts or affiliate checkout flows.
- Guaranteeing 100% catalog coverage of every mouse ever made.
- AI-generated part substitutions without a cited source.
- Offline-only encyclopedic database with no refresh path.
- Full repair tutorials / soldering guides (may link out later).
- Firefox/Safari parity in the first release (Chromium first; others later if demanded).
- Full marketing website in the extension milestone (website is a follow-on on Vercel).

---

## 3. Target Users

| Persona | Needs |
|--------|--------|
| Professional mouse repair tech | Fast, accurate BOM-style parts for a model on the bench |
| Hobbyist modder | Switch/encoder/sensor IDs before ordering |
| Shop inventory manager | Cross-check models against stocked components |
| Contributor / data curator | Add sources and corrections via transparent contribution path |

**Primary:** Professional mouse repair technicians.

---

## 4. Core Product Principles

### 4.1 Accuracy over completeness

- If a field is unknown, show **Unknown** / leave blank. Never invent part numbers, pinouts, or “compatible with” lists.
- Every populated field must have at least one **source citation** (URL + retrieved-at timestamp when scraped).
- Conflicting sources → show conflict, list both sources; do not silently pick a winner.

### 4.2 No hallucination policy

- Model outputs (if any LLM is used later) may only **summarize or structure** text that already exists in retrieved sources.
- LLMs must not invent SKUs, dimensions, or compatibility.
- Default path for v1: **deterministic parsing + curated schema**, not generative fill-in.

### 4.3 Provenance UI

Every result row shows:

- Field value (or Unknown)
- Confidence: `verified` | `sourced` | `community` | `unknown`
- Link(s) to source(s)

---

## 5. User Stories

1. **As a tech**, I type “Logitech G502 Hero” so I can see encoder, main switches, sensor, and MCU when documented.
2. **As a tech**, I search “Razer” and browse a filtered list of models with known part coverage.
3. **As a tech**, I highlight a model name on a product page and trigger “Lookup selection” to pull parts for that model.
4. **As a tech**, I use “Search this page” to scan visible text for mouse model names and open a results panel.
5. **As a tech**, I see Unknown for MCU when no reliable source exists, so I do not order the wrong chip.
6. **As a curator**, I can understand where a value came from and open an issue/PR when a source is wrong.

---

## 6. Feature Requirements

### 6.1 F1 — Global Parts Search (Priority: P0)

**Description:** Extension popup (and optional side panel) with a search bar.

**Inputs:** Free text — brand, model family, model name, or common marketing name.

**Behavior:**

- Debounced search (≥200ms) against local index + remote API/cache.
- Autocomplete suggestions from known models (sourced catalog only).
- Results show a **Parts Card** per matching model:

| Field | Notes |
|-------|--------|
| Brand | Required when known |
| Model name / aliases | Include common names (e.g. Pulsefire Haste) |
| Main / side switches | Part number + manufacturer when known |
| Encoder(s) | Type / part when known |
| Sensor | Part number when known |
| MCU | Part number when known |
| Other (scroll wheel, feet, battery, charging IC, etc.) | Optional extensible key-value |
| Sources | Mandatory for each filled field |
| Last verified | ISO date |

**Empty / low-confidence states:**

- No matches → “No sourced matches. Try a different query or contribute a source.”
- Partial match → show known fields only; unknown fields explicitly labeled.

**Acceptance criteria:**

- [ ] Searching a known model returns structured fields only from the data layer / scrapers.
- [ ] Unknown fields never contain placeholder fake part numbers.
- [ ] Each non-empty field has ≥1 citation URL.

---

### 6.2 F2 — Search Within Page (Priority: P0)

**Description:** Lens-like “find relevant mouse info on this page” without leaving the tab.

**Modes (MVP):**

1. **Selection lookup** — User highlights text → context menu / shortcut → lookup.
2. **Page scan** — User clicks “Scan page” → content script extracts candidate model strings from visible text (and optionally `alt`/`title` attributes) → ranked matches against catalog.
3. **Image region OCR** — User draws a rectangle over the page (or a captured tab screenshot), OCR extracts text, then the same catalog matcher runs. Implemented via `captureVisibleTab` + crop + OCR (e.g. Tesseract in an offscreen document). OCR output is treated as a **query string only**, never as verified part data.

**Behavior:**

- Runs in an isolated content script; does not modify page layout beyond a lightweight overlay/side panel.
- Candidates are matched against the catalog with fuzzy matching; only high-confidence catalog hits auto-open a Parts Card.
- Ambiguous hits present a disambiguation list.
- Low-confidence OCR results prompt the user to confirm/edit the extracted text before search.

**Acceptance criteria:**

- [ ] Highlighting a known model name returns the same Parts Card as global search.
- [ ] Image region OCR can extract a model name from a clear screenshot and search the API.
- [ ] Page scan / OCR never invent part numbers; they only produce search queries.
- [ ] Works on common retail / review / wiki pages without breaking site JS.

---

### 6.3 F3 — Data Acquisition & Web Scraping (Priority: P0)

**Description:** Pipeline to gather and refresh part data from allowlisted sources.

**Rules:**

- Scrapers only hit **allowlisted domains** (configurable).
- Respect `robots.txt`, rate limits, and site ToS; prefer official / documented APIs or static dumps when available.
- Store raw snapshot + parsed structured record + source URL + fetch timestamp.
- Scraped values enter the DB as `sourced` until human review promotes to `verified`.
- Failed parses leave fields blank; never backfill with guesses.

**Initial allowlist candidates (subject to legal/ToS review before enablement):**

- Manufacturer support / product pages (Logitech, Razer, HyperX, etc.)
- Established teardown / parts databases and community wikis with clear licensing
- Datasheet hosts for chips (for cross-linking only when part number already known)

**Out of scope for scrapers:** inventing mappings from marketing blurbs that do not name the part.

**Acceptance criteria:**

- [ ] Every scraped field stores provenance metadata.
- [ ] Scrapers are idempotent and re-runnable.
- [ ] Pipeline can mark stale records (e.g. >N days) for refresh.

---

### 6.4 F4 — Community Veracity (Priority: P0)

**Description:** A **Community** tab in the extension (and later on the website) where users can signal whether a model’s parts card seems accurate.

**Behavior:**

- Per model: **thumbs up** / **thumbs down** (one vote per browser install / anonymous voter id stored locally).
- Display aggregates: `up`, `down`, and a simple veracity ratio (e.g. up / (up+down)).
- Votes never auto-rewrite catalog fields. They are a **signal** for maintainers and other users.
- Optional later: per-field voting; for MVP, vote on the whole model card.
- “Report incorrect data” still opens a GitHub issue template with model, field, current value, suggested correction, source URL.

**Acceptance criteria:**

- [ ] User can upvote/downvote a model and see updated counts from the API.
- [ ] Changing a vote replaces the previous vote (not double-counting).
- [ ] Catalog values are unaffected by votes.

---

### 6.5 F5 — Contribution & Correction Path (Priority: P1)

- In-extension “Report incorrect data” → opens GitHub issue template with model, field, current value, suggested correction, source URL.
- Optional: community JSON/YAML contributions via PR with schema validation in CI.
- Niche brands welcome when accompanied by a citable source.

---

### 6.6 F6 — Caching & Performance (Priority: P1)

- Local cache (chrome.storage / IndexedDB) for recent lookups.
- Offline: show last cached sourced data with “cached at” banner; never invent fresher data offline.
- Popup opens in <200ms with shell UI; results stream in as available.

---

## 7. Information Architecture

### 7.1 Parts schema (conceptual)

```json
{
  "id": "logitech-g502-hero",
  "brand": "Logitech",
  "model": "G502 Hero",
  "aliases": ["G502 HERO"],
  "parts": {
    "main_switches": { "value": null, "sources": [], "confidence": "unknown" },
    "side_switches": { "value": null, "sources": [], "confidence": "unknown" },
    "encoder": { "value": null, "sources": [], "confidence": "unknown" },
    "sensor": { "value": null, "sources": [], "confidence": "unknown" },
    "mcu": { "value": null, "sources": [], "confidence": "unknown" }
  },
  "updated_at": "2026-07-19T00:00:00Z"
}
```

Null/`unknown` is a first-class valid state.

### 7.2 Extension surfaces

| Surface | Role |
|---------|------|
| Popup | Quick search |
| Side panel | Persistent results + page scan |
| Context menu | “Lookup mouse parts” on selection |
| Options page | Allowlist, cache clear, contribution links |

---

## 8. Technical Approach (Proposed)

| Area | Proposal |
|------|----------|
| Extension platform | Chrome Manifest V3 |
| UI | Popup + Side Panel; lightweight Vite build; **Search** + **Community** tabs |
| Hosted API | **Vercel** (Next.js App Router API routes) — search, model detail, votes |
| Catalog | Versioned JSON in-repo; API serves it; scrapers refresh via pipeline |
| Votes store | Persistent store on Vercel (KV/Redis or equivalent); local anonymous voter id in `chrome.storage` |
| Local search cache | MiniSearch / cached API responses in extension storage |
| Content scripts | Selection + page text extraction + region overlay |
| OCR | Offscreen document + Tesseract (or equivalent); query-only |
| Scraping | Cheerio/Playwright in a **separate Node pipeline**, not inside the content script against arbitrary sites |
| Website (later) | Same Vercel project / monorepo app — desktop search UI after extension MVP |
| Auth | None for v1; anonymous voter ids only |

**Why a small hosted API is fine:** Vercel serverless routes are low-ops, share the future website deploy, and keep scrapers/catalog off the client. Complexity is modest compared to scraping + OCR.

**Why scrape outside the extension:** reliability, rate limiting, ToS compliance, and avoiding brittle per-page DOM scraping from user browsers.

### 8.1 Monorepo layout (target)

```
apps/web          → Vercel Next.js (API now; website UI later)
apps/extension    → Chrome MV3 extension
packages/shared   → Types + Zod schema
data/catalog      → Sourced mouse catalog JSON
scripts/scrapers  → Allowlisted acquisition jobs
```

---

## 9. Accuracy & Trust Requirements

1. **Deterministic data path** for displayed part numbers.
2. **Citation required** for every non-empty field.
3. **Conflict display** when sources disagree.
4. **CI schema validation** on catalog PRs.
5. **No generative fill** of empty fields in production.
6. Public **data changelog** so users see what changed and why.

---

## 10. Privacy & Permissions

Request only necessary permissions:

- `activeTab` / host permissions for page scan (narrow where possible)
- `storage` for cache
- `contextMenus` for selection lookup
- `sidePanel` if used

Do not collect browsing history beyond the active lookup action. Do not phone home PII. Telemetry (if ever added) is opt-in and anonymous.

---

## 11. Success Metrics

| Metric | Target (early) |
|--------|----------------|
| % of result fields with citations | 100% of non-empty fields |
| User-reported hallucination issues | Near-zero; treat as P0 bugs |
| Median time-to-parts for a known model | < 5 seconds from query |
| Catalog models with ≥1 verified part field | Grow weekly via scrapers + contributions |

---

## 12. Milestones

### M0 — Foundation
- PRD, decisions log, repo skeleton

### M1 — Hosted API + curated catalog + search popup
- Vercel API (`/api/search`, `/api/models/:id`, `/api/votes`)
- Schema + seed data (mainstream **and** niche brands; empty fields allowed)
- Extension Search tab with Unknown-safe rendering

### M2 — Community veracity
- Thumbs up/down + Community tab aggregates

### M3 — Search within page
- Context menu selection lookup + page scan + **image region OCR**

### M4 — Scraping / import pipeline
- **OEM scrapers** (Logitech/Razer/HyperX/…): robots-checked allowlist, structured specs where present
- **RTINGS scraper**: robots-allowed review pages; free intro/meta extraction only (no paywall bypass)
- TechPowerUp importer (offline `--from-html` by default; live fetch gated on written permission — TPU ToS)
- Curated seed extractions merged into catalog with citations
- Provenance storage; no silent overwrite on conflicts

### M5 — Hardening
- Conflict UI, report-incorrect flow, CI validation, contributor docs

### M6 — Vercel desktop website (after extension)
- Shared API/catalog; desktop search + community UI

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Scraping blocked / ToS | Prefer APIs, mirrors, manual curated imports; keep allowlist small |
| Incomplete catalog frustrates users | UX that celebrates Unknown + contribution CTA |
| Wrong community data | Confidence tiers; votes are signals only; verified ≠ community |
| Brand name ambiguity (e.g. “Pulsefire”) | Disambiguation UI + aliases |
| Niche brand coverage gaps | Accept blanks; prioritize sourced contributions over guessing |
| OCR misreads | Confirm/edit extracted text before search; never treat OCR as part facts |
| Legal on manufacturer assets | Store facts/links, not scraped copyrighted full-page dumps in-repo when prohibited |
| Vote abuse | Rate limits, one vote per voter id, no catalog mutation from votes |

---

## 14. Open Questions (remaining)

1. Licensing for contributed teardown data (CC-BY, ODbL, etc.)?
2. Promote to `verified`: maintainer-only vs trusted contributor role?
3. Production votes store: Vercel KV vs Upstash Redis vs Postgres (Neon)?

---

## 15. Appendix — Example UX Copy

**Empty MCU field:**  
`MCU: Unknown — no sourced documentation yet. [Suggest a source]`

**Conflict:**  
`Encoder: Conflicting sources — TTC Gold (source A) vs unknown (source B)`

**Cached:**  
`Showing cached data from 2026-07-10. Reconnect to refresh.`

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-07-19 | Initial PRD from product kickoff |
| 0.2 | 2026-07-19 | Decisions: niche brands, OCR region, Vercel API, community votes; website after extension |
