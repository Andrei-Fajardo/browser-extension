import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/extension/vendor/tesseract");
mkdirSync(out, { recursive: true });

const copies = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm",
    "tesseract-core-simd-lstm.wasm",
  ],
];

for (const [from, to] of copies) {
  copyFileSync(join(root, from), join(out, to));
}

const langFile = join(out, "eng.traineddata.gz");
if (!existsSync(langFile)) {
  const url = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz";
  console.log("Downloading eng.traineddata.gz…");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download language data: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import("node:fs");
  writeFileSync(langFile, buf);
}

console.log("OCR vendor assets ready at", out);
