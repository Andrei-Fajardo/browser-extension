import { createWorker } from "tesseract.js";

function vendorUrl(file: string): string {
  return chrome.runtime.getURL(`vendor/tesseract/${file}`);
}

async function cropDataUrl(
  dataUrl: string,
  rect: { x: number; y: number; w: number; h: number },
  dpr: number,
): Promise<string> {
  const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const sx = Math.max(0, Math.round(rect.x * dpr));
  const sy = Math.max(0, Math.round(rect.y * dpr));
  const sw = Math.min(img.width - sx, Math.round(rect.w * dpr));
  const sh = Math.min(img.height - sy, Math.round(rect.h * dpr));

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return URL.createObjectURL(blob);
}

async function runOcr(imageUrl: string): Promise<string> {
  const worker = await createWorker("eng", 1, {
    workerPath: vendorUrl("worker.min.js"),
    corePath: vendorUrl("tesseract-core-simd-lstm.wasm.js"),
    langPath: vendorUrl(""),
    workerBlobURL: false,
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(imageUrl);
    return text.replace(/\s+/g, " ").trim();
  } finally {
    await worker.terminate();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OCR_CROP") return false;
  void (async () => {
    try {
      const cropped = await cropDataUrl(message.dataUrl, message.rect, message.dpr ?? 1);
      const text = await runOcr(cropped);
      URL.revokeObjectURL(cropped);
      sendResponse({ text });
    } catch (e) {
      sendResponse({ error: e instanceof Error ? e.message : "OCR failed" });
    }
  })();
  return true;
});
