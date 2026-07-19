#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { loadCatalog, mergeScrapedIntoCatalog, saveCatalog } from "./merge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const curatedPath = path.join(ROOT, "data/scraped/techpowerup/curated-seed.json");
const catalogPath = path.join(ROOT, "data/catalog/mice.json");

const curated = JSON.parse(readFileSync(curatedPath, "utf8"));
const catalog = loadCatalog(catalogPath);

for (const entry of curated.entries) {
  const result = mergeScrapedIntoCatalog(catalog, entry, { createIfMissing: true });
  console.log(result.status, result.id, result.changes?.length ?? 0, "changes");
}

saveCatalog(catalogPath, catalog);
console.log(`Wrote ${catalogPath} (${catalog.models.length} models)`);
