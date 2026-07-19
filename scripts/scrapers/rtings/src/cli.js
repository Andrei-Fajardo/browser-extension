#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  politeFetch,
  loadCatalog,
  saveCatalog,
  mergeScrapedIntoCatalog,
} from "@mouse-parts/scraper-shared";
import { listReviewUrls, parseRtingsReviewHtml } from "./parse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const CATALOG = path.join(ROOT, "data/catalog/mice.json");
const RAW_DIR = path.join(ROOT, "data/scraped/rtings");
const TARGETS = path.join(ROOT, "data/scrapers/rtings-urls.json");
const ALLOW = ["www.rtings.com"];

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? true;
}

async function main() {
  const merge = process.argv.includes("--merge");
  const onlyExisting = process.argv.includes("--only-existing");
  const limit = Number(arg("--limit", "30"));
  const seedUrl = process.argv.includes("--url") ? arg("--url") : null;
  const useTargets = process.argv.includes("--targets") || (!seedUrl && !process.argv.includes("--index"));

  mkdirSync(RAW_DIR, { recursive: true });
  const catalog = merge || onlyExisting ? loadCatalog(CATALOG) : null;

  let urls = [];
  if (seedUrl && seedUrl !== true) {
    urls = [seedUrl];
  } else if (useTargets && existsSync(TARGETS)) {
    urls = JSON.parse(readFileSync(TARGETS, "utf8")).targets ?? [];
    console.log("Using curated RTINGS targets:", urls.length);
  } else {
    console.log("Listing RTINGS mouse reviews…");
    const { html } = await politeFetch("https://www.rtings.com/mouse/reviews", {
      allowHosts: ALLOW,
    });
    urls = listReviewUrls(html);
    console.log("found", urls.length, "review URLs on index");
  }

  urls = urls.slice(0, limit);
  let merged = 0;

  for (const url of urls) {
    try {
      const { html, url: finalUrl, retrievedAt } = await politeFetch(url, {
        allowHosts: ALLOW,
        delayMs: 1400,
      });
      const scraped = parseRtingsReviewHtml(html, finalUrl, retrievedAt);
      if (!scraped) {
        console.log("skip (unparsed)", finalUrl);
        continue;
      }

      writeFileSync(
        path.join(RAW_DIR, `${scraped.id}.json`),
        `${JSON.stringify(scraped, null, 2)}\n`,
      );

      const partKeys = Object.keys(scraped.parts);
      console.log("ok", scraped.brand, scraped.model, partKeys.join(",") || "(identity only)");

      if (catalog) {
        const result = mergeScrapedIntoCatalog(catalog, scraped, {
          createIfMissing: !onlyExisting,
        });
        if (result.status !== "skipped") {
          merged += 1;
          console.log(" merge", result.status, result.id, result.changes?.length ?? 0);
        } else {
          console.log(" merge skipped (no catalog match)");
        }
      }
    } catch (e) {
      console.warn("fail", url, e.message);
    }
  }

  if (catalog && merge) {
    saveCatalog(CATALOG, catalog);
    console.log("catalog saved;", merged, "models touched;", catalog.models.length, "total");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
