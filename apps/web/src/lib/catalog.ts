import type { MouseModel } from "@mouse-parts/shared";
import catalogJson from "../../../../data/catalog/mice.json";

interface CatalogFile {
  version: number;
  updatedAt: string;
  models: MouseModel[];
}

const catalog = catalogJson as CatalogFile;

export function loadCatalog(): CatalogFile {
  return catalog;
}

export function getAllModels(): MouseModel[] {
  return catalog.models;
}

export function getModelById(id: string): MouseModel | undefined {
  return catalog.models.find((m) => m.id === id);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Simple token / substring scorer — deterministic, no generative fill. */
export function searchModels(
  query: string,
  limit = 20,
): Array<{ model: MouseModel; score: number }> {
  const q = normalize(query);
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ model: MouseModel; score: number }> = [];

  for (const model of catalog.models) {
    const haystack = normalize(
      [model.brand, model.model, ...model.aliases, model.id].join(" "),
    );

    if (!tokens.some((t) => haystack.includes(t)) && !haystack.includes(q)) {
      continue;
    }

    let score = 0;
    if (haystack === q) score += 100;
    if (normalize(model.model) === q) score += 80;
    if (normalize(`${model.brand} ${model.model}`) === q) score += 90;
    if (haystack.includes(q)) score += 40;
    for (const t of tokens) {
      if (haystack.includes(t)) score += 10;
      if (normalize(model.brand) === t) score += 15;
    }
    for (const alias of model.aliases) {
      if (normalize(alias) === q) score += 70;
      if (normalize(alias).includes(q)) score += 25;
    }

    if (score > 0) scored.push({ model, score });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
