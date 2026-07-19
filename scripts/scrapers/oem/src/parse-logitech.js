import { sourcedPart, slugifyId } from "@mouse-parts/scraper-shared";

/**
 * Parse Logitech G product pages that embed inRiverTechSpecs.
 */
export function parseLogitechHtml(html, sourceUrl, retrievedAt, hint = {}) {
  const specs = {};

  // JS object form: {facet:"Sensor",values:[{value:"HERO 2"...
  const facetRe =
    /\{facet:"([^"]+)",values:\[\{value:"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = facetRe.exec(html))) {
    specs[m[1].toLowerCase()] = m[2].replace(/\\"/g, '"');
  }

  // Fallback: meta description "HERO 2 sensor"
  if (!specs.sensor) {
    const meta = html.match(
      /<(?:meta)[^>]+content="([^"]*HERO[^"]*)"[^>]*>/i,
    );
    const hero = meta?.[1]?.match(/HERO\s*2?/i);
    if (hero) specs.sensor = hero[0].toUpperCase().replace(/\s+/, " ");
  }

  const brand = hint.brand ?? "Logitech";
  const model = hint.model ?? inferModel(html) ?? "Unknown";
  const title = `Logitech product page: ${brand} ${model}`;
  const parts = {};

  if (specs.sensor) {
    parts.sensor = sourcedPart(specs.sensor, sourceUrl, title, retrievedAt);
  }
  if (specs["button technology"]) {
    parts.mainSwitches = sourcedPart(
      specs["button technology"],
      sourceUrl,
      title,
      retrievedAt,
    );
  }
  if (specs.microprocessor) {
    parts.mcu = sourcedPart(specs.microprocessor, sourceUrl, title, retrievedAt);
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

function inferModel(html) {
  const og = html.match(/property="og:title"[^>]*content="([^"]+)"/i);
  if (!og) return null;
  return og[1]
    .replace(/\s*\|\s*Logitech.*$/i, "")
    .replace(/Wireless Gaming Mouse/i, "")
    .trim();
}
