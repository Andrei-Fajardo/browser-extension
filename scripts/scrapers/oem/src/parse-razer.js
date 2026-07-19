import { sourcedPart, slugifyId } from "@mouse-parts/scraper-shared";

const FIELD_MAP = {
  sensor: "sensor",
  "sensor technology": "sensor",
  switches: "mainSwitches",
  "mouse switch": "mainSwitches",
  "main switches": "mainSwitches",
};

/**
 * Parse Razer product pages that embed classification featureValues.
 */
export function parseRazerHtml(html, sourceUrl, retrievedAt, hint = {}) {
  const specs = {};
  const re =
    /"name":"([^"]+)","range":false(?:,"[^"]*":[^,]*)*,"featureValues":\[\{"value":"([^"]+)"\}\]/g;
  // The order of keys varies; use a looser scan
  const loose =
    /"code":"razerClassification[^"]+\.([^"]+)","comparable":true,"featureValues":\[\{"value":"([^"]+)"\}\],"name":"([^"]+)"/g;

  let m;
  while ((m = loose.exec(html))) {
    const name = m[3].toLowerCase();
    const value = m[2];
    specs[name] = value;
  }

  // Alternate key order
  const alt =
    /"name":"([^"]+)","range":false\},\{"code":"razerClassification[^"]+","comparable":true,"featureValues":\[\{"value":"([^"]+)"\}\]/g;
  while ((m = alt.exec(html))) {
    specs[m[1].toLowerCase()] = m[2];
  }

  // Direct name/value adjacency seen in dumps
  const direct =
    /"featureValues":\[\{"value":"([^"]+)"\}\],"name":"(Sensor|Sensor Technology|Switches)"/g;
  while ((m = direct.exec(html))) {
    specs[m[2].toLowerCase()] = m[1];
  }

  const brand = hint.brand ?? "Razer";
  const model = hint.model ?? inferModel(html) ?? "Unknown";
  const title = `Razer product page: ${brand} ${model}`;
  const parts = {};

  for (const [label, field] of Object.entries(FIELD_MAP)) {
    const value = specs[label];
    if (!value) continue;
    // Skip ultra-generic switch label if we already would fill nothing else? Keep it — sourced.
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

function inferModel(html) {
  const og = html.match(/property="og:title"[^>]*content="([^"]+)"/i);
  if (!og) return null;
  return og[1]
    .replace(/\s*[-|].*Razer.*$/i, "")
    .replace(/Ultralight.*$/i, "")
    .trim();
}
