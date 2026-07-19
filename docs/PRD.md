# Product Requirements Document (PRD)

**Product:** Mouse Parts Lookup — Browser Extension  
**Repository:** https://github.com/Andrei-Fajardo/browser-extension  
**Status:** Draft v0.1  
**Last updated:** 2026-07-19  
**Owner:** Andrei Fajardo  

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

**Modes (v1):**

1. **Selection lookup** — User highlights text → context menu / shortcut → lookup.
2. **Page scan** — User clicks “Scan page” → content script extracts candidate model strings from visible text (and optionally `alt`/`title` attributes) → ranked matches against catalog.

**Modes (v1.1 / later):**

3. **Image / OCR assist** — Optional: capture a region or use page images + OCR to extract model text (Chrome APIs / offscreen document). Explicitly secondary; text path ships first.

**Behavior:**

- Runs in an isolated content script; does not modify page layout beyond a lightweight overlay/side panel.
- Candidates are matched against the catalog with fuzzy matching; only high-confidence catalog hits auto-open a Parts Card.
- Ambiguous hits present a disambiguation list.

**Acceptance criteria:**

- [ ] Highlighting a known model name returns the same Parts Card as global search.
- [ ] Page scan does not inject unverified part data into the host page DOM as facts.
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

### 6.4 F4 — Contribution & Correction Path (Priority: P1)

- In-extension “Report incorrect data” → opens GitHub issue template with model, field, current value, suggested correction, source URL.
- Optional: community JSON/YAML contributions via PR with schema validation in CI.

---

### 6.5 F5 — Caching & Performance (Priority: P1)

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
| UI | Popup + Side Panel; vanilla or lightweight React/Vite |
| Local search | FlexSearch / MiniSearch over curated catalog |
| Content scripts | Selection + page text extraction |
| Backend (optional v1) | Static JSON published in-repo or GitHub Pages / CDN; scrapers as Node scripts in CI or scheduled jobs |
| Scraping | Cheerio/Playwright in a **separate Node pipeline**, not inside the content script against arbitrary sites |
| Auth | None for v1 read-only public data |

**Why scrape outside the extension:** reliability, rate limiting, ToS compliance, and avoiding brittle per-page DOM scraping from user browsers.

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

### M0 — Foundation (this PR)
- PRD, repo skeleton, contribution/accuracy policy stub

### M1 — Curated catalog + search popup
- Schema, seed data (only verified/sourced entries), search UI, Unknown-safe rendering

### M2 — Search within page
- Context menu selection lookup + page scan side panel

### M3 — Scraping pipeline
- Allowlisted scrapers, provenance storage, refresh job, catalog publish

### M4 — Hardening
- Conflict UI, report-incorrect flow, CI validation, docs for contributors

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Scraping blocked / ToS | Prefer APIs, mirrors, manual curated imports; keep allowlist small |
| Incomplete catalog frustrates users | UX that celebrates Unknown + contribution CTA |
| Wrong community data | Confidence tiers; verified ≠ community |
| Brand name ambiguity (e.g. “Pulsefire”) | Disambiguation UI + aliases |
| Legal on manufacturer assets | Store facts/links, not scraped copyrighted full-page dumps in-repo when prohibited |

---

## 14. Open Questions

1. Prefer **in-repo static catalog** only for v1, or a small hosted API?
2. Which initial brands to prioritize (Logitech, Razer, HyperX/Pulsefire, Glorious, etc.)?
3. Is image/OCR required for MVP, or text selection + page scan enough?
4. Who owns “verified” promotion (maintainer-only vs trusted contributors)?
5. Licensing for contributed teardown data (CC-BY, ODbL, etc.)?

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
