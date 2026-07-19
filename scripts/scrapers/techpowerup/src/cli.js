#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { politeFetch, hasWrittenPermission } from "./fetch.js";
import { listMouseReviews } from "./list.js";
import { parseReviewHtml } from "./parse.js";
import { loadCatalog, mergeScrapedIntoCatalog, saveCatalog } from "./merge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const DEFAULT_CATALOG = path.join(ROOT, "data/catalog/mice.json");
const RAW_DIR = path.join(ROOT, "data/scraped/techpowerup");

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? true;
}

function printHelp() {
  console.log(`TechPowerUp mouse review importer

IMPORTANT: TechPowerUp prohibits automated scraping without written permission.
Prefer --from-html (offline). Live --url / --list require TPU_I_HAVE_PERMISSION=1.

Usage:
  node src/cli.js --from-html path/to/review.html --source-url https://www.techpowerup.com/review/.../ [--merge]
  node src/cli.js --url https://www.techpowerup.com/review/slug/ [--merge]   # needs permission env
  node src/cli.js --list --max-pages 1                                     # needs permission env

Flags:
  --merge              Write into data/catalog/mice.json
  --catalog <path>     Catalog path (default: data/catalog/mice.json)
  --no-create          Only update existing catalog models
  --save-raw           Save parsed JSON under data/scraped/techpowerup/
`);
}

async function ingestHtml(html, sourceUrl, retrievedAt, opts) {
  const scraped = parseReviewHtml(html, sourceUrl, retrievedAt);
  if (!scraped) {
    console.error("No specs table found in HTML.");
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ id: scraped.id, brand: scraped.brand, model: scraped.model, parts: scraped.parts }, null, 2));

  if (opts.saveRaw) {
    mkdirSync(RAW_DIR, { recursive: true });
    const out = path.join(RAW_DIR, `${scraped.id}.json`);
    writeFileSync(out, `${JSON.stringify(scraped, null, 2)}\n`);
    console.log(`Saved raw parse → ${out}`);
  }

  if (opts.merge) {
    const catalog = loadCatalog(opts.catalog);
    const result = mergeScrapedIntoCatalog(catalog, scraped, {
      createIfMissing: !opts.noCreate,
    });
    saveCatalog(opts.catalog, catalog);
    console.log("Merge:", result);
  }
}

async function main() {
  if (arg("--help") || arg("-h")) {
    printHelp();
    return;
  }

  const opts = {
    merge: Boolean(arg("--merge")),
    catalog: arg("--catalog", DEFAULT_CATALOG),
    noCreate: Boolean(arg("--no-create")),
    saveRaw: Boolean(arg("--save-raw")),
  };

  const fromHtml = arg("--from-html");
  const url = arg("--url");
  const list = Boolean(arg("--list"));

  if (fromHtml) {
    const sourceUrl = arg("--source-url");
    if (!sourceUrl) {
      console.error("--from-html requires --source-url for citations");
      process.exit(1);
    }
    const html = readFileSync(fromHtml, "utf8");
    await ingestHtml(html, sourceUrl, new Date().toISOString(), opts);
    return;
  }

  if (list) {
    if (!hasWrittenPermission()) {
      printHelp();
      console.error("\nRefusing --list without TPU_I_HAVE_PERMISSION=1");
      process.exit(1);
    }
    const maxPages = Number(arg("--max-pages", "1"));
    const urls = await listMouseReviews({ maxPages });
    console.log(urls.join("\n"));
    console.log(`\n${urls.length} URLs`);
    return;
  }

  if (url) {
    const { html, url: finalUrl, retrievedAt } = await politeFetch(url);
    await ingestHtml(html, finalUrl, retrievedAt, opts);
    return;
  }

  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
