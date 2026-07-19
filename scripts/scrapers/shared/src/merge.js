import { readFileSync, writeFileSync } from "node:fs";

export function emptyPart() {
  return { value: null, confidence: "unknown", sources: [] };
}

function normalizeName(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
    return m.aliases.some((a) => {
      const na = normalizeName(a);
      return na === normalizeName(scraped.model) || na === scrapedFull;
    });
  });
}

function ensureParts(model) {
  for (const key of ["mainSwitches", "sideSwitches", "encoder", "sensor", "mcu"]) {
    if (!model.parts[key]) model.parts[key] = emptyPart();
  }
}

export function mergeScrapedIntoCatalog(catalog, scraped, { createIfMissing = true } = {}) {
  let model = findCatalogMatch(catalog, scraped);
  const created = !model;

  if (!model) {
    if (!createIfMissing) return { status: "skipped", reason: "no-match", id: scraped.id };
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

  for (const [field, part] of Object.entries(scraped.parts ?? {})) {
    if (!part?.value) continue;
    const value = String(part.value).trim();
    if (!value || /^n\/?a$/i.test(value) || value === "-") continue;

    const current = model.parts[field] ?? emptyPart();

    if (!current.value) {
      model.parts[field] = {
        value,
        confidence: "sourced",
        sources: part.sources ?? [],
      };
      changes.push({ field, action: "filled", value });
      continue;
    }

    if (normalizeName(current.value) === normalizeName(value)) {
      const url = part.sources?.[0]?.url;
      if (url && !current.sources.some((s) => s.url === url)) {
        current.sources.push(...part.sources);
        changes.push({ field, action: "source-added", value });
      }
      continue;
    }

    const conflictSource = {
      ...part.sources[0],
      title: `${part.sources[0].title} (conflicting value: ${value})`,
    };
    if (!current.sources.some((s) => s.title === conflictSource.title)) {
      current.sources.push(conflictSource);
      current.notes = `Conflicting sourced value also reported: ${value}`;
      changes.push({ field, action: "conflict-recorded", existing: current.value, incoming: value });
    }
  }

  if (changes.length) model.updatedAt = scraped.retrievedAt;
  return { status: created ? "created" : "updated", id: model.id, changes };
}

export function slugifyId(brand, model) {
  return `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sourcedPart(value, url, title, retrievedAt) {
  return {
    value,
    confidence: "sourced",
    sources: [{ url, title, retrievedAt }],
  };
}
