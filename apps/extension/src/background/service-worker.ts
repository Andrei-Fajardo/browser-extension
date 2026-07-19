import { searchModels } from "../lib/api";

const MENU_LOOKUP = "mouse-parts-lookup-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_LOOKUP,
    title: "Lookup mouse parts: “%s”",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_LOOKUP || !info.selectionText) return;
  const query = info.selectionText.trim();
  try {
    const results = await searchModels(query);
    await chrome.storage.session.set({
      pendingPageQuery: query,
      lastLookup: { query, results, at: Date.now() },
    });
  } catch (e) {
    await chrome.storage.session.set({
      pendingPageQuery: query,
      lastLookupError: e instanceof Error ? e.message : "Lookup failed",
    });
  }
});

async function ensureOffscreen(): Promise<void> {
  if (chrome.offscreen.hasDocument) {
    const exists = await chrome.offscreen.hasDocument();
    if (exists) return;
  }
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.WORKERS, chrome.offscreen.Reason.BLOBS],
    justification: "Run OCR on a cropped screenshot region for mouse model lookup",
  });
}

async function runRegionOcrPipeline(): Promise<{ text?: string; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.windowId == null) {
    return { error: "No active tab" };
  }

  const region = (await chrome.tabs.sendMessage(tab.id, {
    type: "PICK_REGION",
  })) as {
    rect?: { x: number; y: number; w: number; h: number };
    dpr?: number;
    error?: string;
  };

  if (region?.error || !region?.rect) {
    return { error: region?.error ?? "Region selection cancelled" };
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  await ensureOffscreen();
  return (await chrome.runtime.sendMessage({
    type: "OCR_CROP",
    dataUrl,
    rect: region.rect,
    dpr: region.dpr ?? 1,
  })) as { text?: string; error?: string };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_REGION_OCR") {
    void (async () => {
      await chrome.storage.session.set({ ocrStatus: "selecting" });
      const ocr = await runRegionOcrPipeline();
      if (ocr.error) {
        await chrome.storage.session.set({ ocrStatus: "error", ocrError: ocr.error });
        sendResponse({ error: ocr.error });
        return;
      }
      await chrome.storage.session.set({
        ocrStatus: "done",
        pendingPageQuery: ocr.text ?? "",
        ocrError: null,
      });
      sendResponse({ text: ocr.text ?? "" });
    })();
    return true;
  }
  return false;
});
