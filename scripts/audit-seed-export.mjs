/**
 * Audit MousePartsVisualizer seed-mice-export.json for parser garbage.
 *
 * Usage:
 *   node scripts/audit-seed-export.mjs "f:/Backup/Ramsta E/Coding Projects/MousePartsVisualizer/seed-mice-export.json"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/audit-seed-export.mjs <path-to-seed-mice-export.json>");
  process.exit(1);
}

const seed = JSON.parse(readFileSync(resolve(input), "utf8"));

function isValidHuanoColorModel(sw) {
  return (
    /^huano$/i.test(sw?.brand || "") &&
    /shell/i.test(sw?.model || "") &&
    /(blue|pink|red|green|white|dot)/i.test(sw?.model || "")
  );
}

function switchIssue(sw) {
  if (!sw) return "missing";
  if (isValidHuanoColorModel(sw)) return null;
  const b = (sw.brand || "").trim();
  const m = (sw.model || "").trim();
  if (/^(blue|white|black|red|green|yellow|pink|shell|core|china|japan|optical|mechanical|customizable)$/i.test(b)) {
    return "color_as_brand";
  }
  if (/^(shell|transparent shell)$/i.test(m) && !/^huano$/i.test(b)) return "color_as_model";
  if (/^hunao$/i.test(b)) return "typo";
  if (b && m && b.toLowerCase() === m.toLowerCase() && b.length <= 8) return "brand_eq_model_weak";
  return null;
}

function encoderIssue(e) {
  if (!e) return "missing";
  const b = (e.brand || "").trim();
  if (!b || /^unknown$/i.test(b)) return "unknown";
  if (/^(F|CF)$/i.test(b)) return "truncated";
  return null;
}

const buckets = {
  importable: [],
  switchGarbage: [],
  encoderTruncated: [],
  bothBad: [],
  weakSwitch: [],
};

for (const m of seed.mice) {
  const sg = switchIssue(m.primarySwitches?.[0]);
  const eg = encoderIssue(m.encoder);
  const row = {
    id: m.id,
    brand: m.brand,
    model: m.model,
    switch: m.primarySwitches?.[0] ?? null,
    encoder: m.encoder ?? null,
    sensor: m.sensor ?? null,
    switchIssue: sg,
    encoderIssue: eg,
  };

  if (sg === "color_as_brand" || sg === "color_as_model" || sg === "typo") {
    if (eg === "truncated") buckets.bothBad.push(row);
    else buckets.switchGarbage.push(row);
  } else if (eg === "truncated") {
    buckets.encoderTruncated.push(row);
  } else if (sg === "brand_eq_model_weak") {
    buckets.weakSwitch.push(row);
  } else {
    buckets.importable.push(row);
  }
}

const report = {
  auditedAt: new Date().toISOString(),
  source: resolve(input),
  total: seed.mice.length,
  summary: {
    importable: buckets.importable.length,
    switchGarbage: buckets.switchGarbage.length,
    encoderTruncated: buckets.encoderTruncated.length,
    bothBad: buckets.bothBad.length,
    weakSwitch: buckets.weakSwitch.length,
    mcuPresent: seed.mice.filter((m) => m.mcu).length,
    withCitationUrl: seed.mice.filter((m) => m.sourceUrl || m.url || (m.sources && m.sources.length)).length,
  },
  rootCauses: [
    "parseSwitch() mangled TPU color/shell descriptions into brand=blue model=shell",
    "scrapeEncoderDetails() used (\\w+) and truncated F-Switch to F / CF-Switch to CF",
    "MCU never scraped from TPU specs table",
    "No per-mouse source URL in export",
  ],
  examples: {
    switchGarbage: buckets.switchGarbage.slice(0, 15),
    encoderTruncated: buckets.encoderTruncated.slice(0, 15),
    validHuanoColorName: seed.mice
      .filter((m) => isValidHuanoColorModel(m.primarySwitches?.[0]))
      .slice(0, 8)
      .map((m) => ({ id: m.id, switch: m.primarySwitches[0] })),
    spotlight: [
      "logitech-gpro-x-superlight-2",
      "logitech-g-pro-x-superlight",
      "hyperx-pulsefire-haste-2",
      "razer-viper-v3-pro",
      "lamzu-atlantis-mini",
    ].map((id) => {
      const m = seed.mice.find((x) => x.id === id);
      if (!m) return { id, missing: true };
      return {
        id,
        switch: m.primarySwitches?.[0],
        encoder: m.encoder,
        sensor: m.sensor,
        switchIssue: switchIssue(m.primarySwitches?.[0]),
        encoderIssue: encoderIssue(m.encoder),
      };
    }),
  },
  importableIds: buckets.importable.map((r) => r.id),
  rejectIds: [...buckets.switchGarbage, ...buckets.encoderTruncated, ...buckets.bothBad].map((r) => r.id),
};

const outPath = resolve("docs/seed-audit-mousepartsvisualizer.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log("Wrote", outPath);
