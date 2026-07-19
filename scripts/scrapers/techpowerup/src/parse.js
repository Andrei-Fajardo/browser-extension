import * as cheerio from "cheerio";

const SPEC_MAP = {
  "main switches": "mainSwitches",
  "side switches": "sideSwitches",
  "wheel encoder": "encoder",
  encoder: "encoder",
  sensor: "sensor",
  "microcontroller unit": "mcu",
  microcontroller: "mcu",
  mcu: "mcu",
};

/** Values that are too vague to treat as useful part IDs — still stored if present, but flagged. */
const LOW_SIGNAL = new Set(["mechanical", "optical", "yes", "no", "n/a", "unknown", "-"]);

function cleanText(s) {
  return s.replace(/\s+/g, " ").trim();
}

function slugifyId(brand, model) {
  return `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Parse a TechPowerUp mouse review HTML page into structured parts.
 * Does not invent fields — only maps rows present in the specs table.
 */
export function parseReviewHtml(html, sourceUrl, retrievedAt) {
  const $ = cheerio.load(html);
  const title =
    cleanText($("h1").first().text()).replace(/\s+Review.*$/i, "") ||
    cleanText($('meta[property="og:title"]').attr("content") || "").replace(
      /\s+Review.*$/i,
      "",
    );

  const table = $("table.tputbl").first();
  if (!table.length) {
    return null;
  }

  const headerName = cleanText(table.find("thead th").first().text()) || title;
  const specs = {};
  table.find("tr").each((_, tr) => {
    const key = cleanText($(tr).find("th[scope='row']").text()).replace(/:$/, "");
    const value = cleanText($(tr).find("td").first().text());
    if (!key || !value) return;
    specs[key.toLowerCase()] = value;
  });

  const parts = {};
  for (const [label, field] of Object.entries(SPEC_MAP)) {
    const value = specs[label];
    if (!value) continue;
    parts[field] = {
      value,
      confidence: "sourced",
      lowSignal: LOW_SIGNAL.has(value.toLowerCase()),
      sources: [
        {
          url: sourceUrl,
          title: `TechPowerUp: ${headerName}`,
          retrievedAt,
        },
      ],
    };
  }

  // Infer brand/model from header when possible (first token(s) heuristics).
  const { brand, model } = splitBrandModel(headerName);

  return {
    id: slugifyId(brand, model),
    brand,
    model,
    aliases: title && title !== headerName ? [title] : [],
    sourceUrl,
    retrievedAt,
    rawSpecs: specs,
    parts,
  };
}

function splitBrandModel(name) {
  const known = [
    "Endgame Gear",
    "Attack Shark",
    "G-Wolves",
    "SteelSeries",
    "Finalmouse",
    "Cooler Master",
    "HyperX",
    "Logitech",
    "Razer",
    "Pulsar",
    "Lamzu",
    "Vaxee",
    "VAXEE",
    "Darmoshark",
    "WLMouse",
    "Zaunkoenig",
    "Glorious",
    "Corsair",
    "ASUS",
    "Zowie",
  ];
  const trimmed = cleanText(name);
  for (const brand of known) {
    if (trimmed.toLowerCase().startsWith(brand.toLowerCase() + " ")) {
      return {
        brand: brand === "VAXEE" ? "Vaxee" : brand,
        model: cleanText(trimmed.slice(brand.length)),
      };
    }
  }
  const [first, ...rest] = trimmed.split(/\s+/);
  return { brand: first || "Unknown", model: rest.join(" ") || trimmed };
}

export function emptyPart() {
  return { value: null, confidence: "unknown", sources: [] };
}
