import * as cheerio from "cheerio";
import { sourcedPart, slugifyId } from "@mouse-parts/scraper-shared";

/**
 * Conservative generic OEM parser: JSON-LD + labeled spec rows + description cues.
 * Only emits values tied to explicit labels or unambiguous marketing sensor names.
 */
export function parseGenericOemHtml(html, sourceUrl, retrievedAt, hint = {}) {
  const $ = cheerio.load(html);
  const brand = hint.brand ?? $("meta[property='og:site_name']").attr("content") ?? "Unknown";
  const model =
    hint.model ??
    ($("meta[property='og:title']").attr("content") || "")
      .split("|")[0]
      .split("-")[0]
      .trim();

  const title = `${brand} product page: ${model}`;
  const parts = {};
  const specs = {};

  // JSON-LD Product description cues
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "");
      const blocks = Array.isArray(data) ? data : [data];
      for (const b of blocks) {
        if (b["@type"] === "Product" && typeof b.description === "string") {
          const hero = b.description.match(/\bHERO(?:\s*2)?\b/i);
          if (hero) specs.sensor = hero[0].replace(/\s+/, " ");
          const focus = b.description.match(/Focus Pro[^\n,<]{0,40}/i);
          if (focus) specs.sensor = focus[0].trim();
        }
      }
    } catch {
      /* ignore */
    }
  });

  // Labeled rows
  $("tr").each((_, tr) => {
    const cells = $(tr).find("th,td");
    if (cells.length < 2) return;
    const key = $(cells[0]).text().replace(/\s+/g, " ").trim().toLowerCase();
    const value = $(cells[1]).text().replace(/\s+/g, " ").trim();
    if (!value) return;
    if (/^sensor/.test(key)) specs.sensor = value;
    if (/switch/.test(key) && /main|button|primary/.test(key)) specs.mainSwitches = value;
    if (/microcontroller|mcu|processor/.test(key)) specs.mcu = value;
    if (/encoder/.test(key)) specs.encoder = value;
  });

  // Meta description sensor
  const desc = $('meta[name="description"]').attr("content") || "";
  if (!specs.sensor) {
    const hero = desc.match(/\bHERO(?:\s*2)?\b/i);
    if (hero) specs.sensor = hero[0].replace(/\s+/, " ");
  }

  for (const [field, value] of Object.entries(specs)) {
    parts[field] = sourcedPart(value, sourceUrl, title, retrievedAt);
  }

  if (!Object.keys(parts).length) return null;

  return {
    id: hint.id ?? slugifyId(brand, model),
    brand,
    model,
    aliases: [],
    sourceUrl,
    retrievedAt,
    parts,
    raw: specs,
  };
}
