#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCatalog,
  saveCatalog,
  mergeScrapedIntoCatalog,
} from "@mouse-parts/scraper-shared";
import { parseLogitechHtml } from "./parse-logitech.js";
import { parseRazerHtml } from "./parse-razer.js";
import { parseGenericOemHtml } from "./parse-generic.js";
import { fetchOem } from "./fetch-fallback.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const TARGETS = path.join(ROOT, "data/scrapers/oem-urls.json");
const CATALOG = path.join(ROOT, "data/catalog/mice.json");
const RAW_DIR = path.join(ROOT, "data/scraped/oem");

const ALLOW_HOSTS = [
  "www.logitechg.com",
  "www.razer.com",
  "steelseries.com",
  "www.steelseries.com",
  "hyperx.com",
  "www.hyperxgaming.com",
];

function parseForHost(hostname, html, url, retrievedAt, hint) {
  if (hostname.includes("logitech")) {
    return parseLogitechHtml(html, url, retrievedAt, hint);
  }
  if (hostname.includes("razer")) {
    return parseRazerHtml(html, url, retrievedAt, hint);
  }
  return parseGenericOemHtml(html, url, retrievedAt, hint);
}

async function main() {
  const merge = process.argv.includes("--merge");
  const create = !process.argv.includes("--no-create");
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : Infinity;

  const { targets } = JSON.parse(readFileSync(TARGETS, "utf8"));
  const catalog = merge ? loadCatalog(CATALOG) : null;
  mkdirSync(RAW_DIR, { recursive: true });

  let n = 0;
  for (const target of targets) {
    if (n >= limit) break;
    const hint = { id: target.id, brand: target.brand, model: target.model };
    let best = null;

    for (const url of target.urls) {
      try {
        const { html, url: finalUrl, retrievedAt } = await fetchOem(url, ALLOW_HOSTS);
        const host = new URL(finalUrl).hostname;
        const scraped = parseForHost(host, html, finalUrl, retrievedAt, hint);
        if (!scraped) {
          console.log("no parts", finalUrl);
          continue;
        }
        best = scraped;
        writeFileSync(
          path.join(RAW_DIR, `${target.id}.json`),
          `${JSON.stringify(scraped, null, 2)}\n`,
        );
        console.log(
          "ok",
          target.id,
          Object.keys(scraped.parts).join(","),
          "←",
          finalUrl,
        );
        break;
      } catch (e) {
        console.warn("fail", url, e.message);
      }
    }

    if (best && catalog) {
      const result = mergeScrapedIntoCatalog(catalog, best, { createIfMissing: create });
      console.log("merge", result.status, result.id, result.changes?.length ?? 0);
    }
    n += 1;
  }

  if (catalog) {
    saveCatalog(CATALOG, catalog);
    console.log("catalog saved", CATALOG, catalog.models.length, "models");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
