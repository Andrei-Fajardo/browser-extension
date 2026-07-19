import * as cheerio from "cheerio";
import { sourcedPart, slugifyId } from "@mouse-parts/scraper-shared";

const BRAND_MAP = {
  logitech: "Logitech",
  razer: "Razer",
  steelseries: "SteelSeries",
  hyperx: "HyperX",
  glorious: "Glorious",
  corsair: "Corsair",
  pulsar: "Pulsar",
  lamzu: "Lamzu",
  vaxee: "Vaxee",
  "attack-shark": "Attack Shark",
  attackshark: "Attack Shark",
  wlmouse: "WLMouse",
  "g-wolves": "G-Wolves",
  endgamegear: "Endgame Gear",
  "endgame-gear": "Endgame Gear",
  finalmouse: "Finalmouse",
  zaunkoenig: "Zaunkoenig",
  mchose: "MCHOSE",
  vxe: "VXE",
  asus: "ASUS",
  keychron: "Keychron",
};

/**
 * RTINGS detailed test matrices are often client/paywall gated.
 * Identity comes from the URL; parts come only from free intro/meta text.
 */
export function parseRtingsReviewHtml(html, sourceUrl, retrievedAt) {
  const $ = cheerio.load(html);
  const decoded = html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

  const pathParts = new URL(sourceUrl).pathname.split("/").filter(Boolean);
  // /mouse/reviews/{brand}/{slug}
  const brandSlug = pathParts[2] || "";
  const modelSlug = pathParts[3] || "";
  const brand = BRAND_MAP[brandSlug] ?? titleCase(brandSlug.replace(/-/g, " "));
  let model = titleCase(modelSlug.replace(/-/g, " "));

  const productName =
    decoded.match(/"product"\s*:\s*\{[\s\S]*?"fullname"\s*:\s*"([^"]+)"/)?.[1] ||
    ($('meta[property="og:title"]').attr("content") || "")
      .replace(/\s*Review.*$/i, "")
      .trim();

  if (productName) {
    // Prefer official product name when it clearly belongs to this brand slug
    const stripped = productName.replace(new RegExp("^" + escapeReg(brand) + "\\s+", "i"), "").trim();
    if (stripped) model = stripped;
  }

  const intro =
    decoded.match(/"introduction_linked"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] || "";
  const introText = intro
    .replace(/\\u003c\/?\w+[^\\]*\\u003e/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ");

  const metaDesc = $('meta[name="description"]').attr("content") || "";
  const blob = `${introText} ${metaDesc}`;

  const parts = {};
  const title = `RTINGS: ${brand} ${model}`;

  const sensorMatch =
    blob.match(/\bHERO(?:\s*2)?\b/i) ||
    blob.match(/\bFocus Pro[^.!]{0,48}?(?:Sensor(?:\s+Gen-\d+)?)?/i) ||
    blob.match(/\bPixArt\s+PAW\d{4}\b/i) ||
    blob.match(/\bTrueMove(?:\s+[A-Za-z0-9]+)?\b/i) ||
    blob.match(
      /\b(?:updated|uses|with|featuring)\s+(?:an?\s+)?([A-Z0-9][A-Za-z0-9][A-Za-z0-9 /-]{1,40}\s+sensor)\b/i,
    );

  if (sensorMatch) {
    const sensor = cleanSensor(sensorMatch[1] || sensorMatch[0]);
    parts.sensor = sourcedPart(sensor, sourceUrl, title, retrievedAt);
  }

  const sw = blob.match(
    /\b((?:LIGHTFORCE|Razer(?:™|\u2122)? Optical(?: Mouse)? Switches?(?: Gen-\d+)?)|(?:optical|mechanical)\s+switches?)\b/i,
  );
  if (sw) {
    parts.mainSwitches = sourcedPart(sw[1], sourceUrl, title, retrievedAt);
  }

  return {
    id: slugifyId(brand, model),
    brand,
    model,
    aliases: productName && productName !== `${brand} ${model}` ? [productName] : [],
    sourceUrl,
    retrievedAt,
    parts,
  };
}

function cleanSensor(s) {
  return s.replace(/\s+/g, " ").replace(/\band\b.*$/i, "").trim();
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function listReviewUrls(html) {
  const urls = new Set();
  const decoded = html.replace(/&quot;/g, '"');
  const re = /\/mouse\/reviews\/[a-z0-9-]+\/[a-z0-9-]+/gi;
  let m;
  while ((m = re.exec(decoded))) {
    urls.add(new URL(m[0], "https://www.rtings.com").href);
  }
  return [...urls];
}
