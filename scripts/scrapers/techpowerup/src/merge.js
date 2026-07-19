import { readFileSync, writeFileSync } from "node:fs";
import { emptyPart } from "./parse.js";

function normalizeName(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  // Avoid "Atlantis Mini" matching "Atlantis Mini Pro"
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (longer.startsWith(shorter + " ")) return false;
  return na.includes(nb) || nb.includes(na);
}

export function loadCatalog(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveCatalog(path, catalog) {
  catalog.updatedAt = new Date().toISOString();
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

export function findCatalogMatch(catalog, scraped) {
  const byId = catalog.models.find((m) => m.id === scraped.id);
  if (byId) return byId;

  const scrapedFull = normalizeName(`${scraped.brand} ${scraped.model}`);

  return catalog.models.find((m) => {
    if (normalizeName(m.brand) !== normalizeName(scraped.brand)) return false;
    if (normalizeName(m.model) === normalizeName(scraped.model)) return true;
    // Aliases: exact normalized match only (prevents Mini → Mini Pro bleed)
    const aliasHit = m.aliases.some((a) => {
      const na = normalizeName(a);
      return na === normalizeName(scraped.model) || na === scrapedFull;
    });
    return aliasHit;
  });
}

function ensureParts(model) {
  for (const key of ["mainSwitches", "sideSwitches", "encoder", "sensor", "mcu"]) {
    if (!model.parts[key]) model.parts[key] = emptyPart();
  }
}

/**
 * Merge scraped fields into catalog.
 * - Never invent values
 * - Fill null fields from scrape
 * - If existing value differs, keep existing and attach conflicting source note (no silent overwrite)
 */
export function mergeScrapedIntoCatalog(catalog, scraped, { createIfMissing = true } = {}) {
  let model = findCatalogMatch(catalog, scraped);
  const created = !model;

  if (!model) {
    if (!createIfMissing) {
      return { status: "skipped", reason: "no-match" };
    }
    model = {
      id: scraped.id,
      brand: scraped.brand,
      model: scraped.model,
      aliases: scraped.aliases ?? [],
      updatedAt: scraped.retrievedAt,
      parts: {
        mainSwitches: emptyPart(),
        sideSwitches: emptyPart(),
        encoder: emptyPart(),
        sensor: emptyPart(),
        mcu: emptyPart(),
      },
    };
    catalog.models.push(model);
  }

  ensureParts(model);
  const changes = [];

  for (const [field, part] of Object.entries(scraped.parts)) {
    if (!part?.value) continue;
    // Skip ultra-vague encoder labels unless field is empty? Keep them — still sourced.
    const current = model.parts[field] ?? emptyPart();

    if (!current.value) {
      model.parts[field] = {
        value: part.value,
        confidence: "sourced",
        sources: part.sources,
      };
      changes.push({ field, action: "filled", value: part.value });
      continue;
    }

    if (normalizeName(current.value) === normalizeName(part.value)) {
      const hasSource = current.sources.some((s) => s.url === part.sources[0]?.url);
      if (!hasSource) {
        current.sources.push(...part.sources);
        changes.push({ field, action: "source-added", value: part.value });
      }
      continue;
    }

    // Conflict: keep existing value, record alternate in notes via sources list with prefix
    const conflictSource = {
      ...part.sources[0],
      title: `${part.sources[0].title} (conflicting value: ${part.value})`,
    };
    if (!current.sources.some((s) => s.title === conflictSource.title)) {
      current.sources.push(conflictSource);
      current.notes = `Conflicting sourced value also reported: ${part.value}`;
      changes.push({ field, action: "conflict-recorded", existing: current.value, incoming: part.value });
    }
  }

  if (changes.length) {
    model.updatedAt = scraped.retrievedAt;
  }

  return { status: created ? "created" : "updated", id: model.id, changes };
}
