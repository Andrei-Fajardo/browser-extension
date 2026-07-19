const KNOWN_HINTS = [
  "logitech",
  "razer",
  "hyperx",
  "pulsefire",
  "steelseries",
  "corsair",
  "vaxee",
  "lamzu",
  "pulsar",
  "finalmouse",
  "zaunkoenig",
  "darmoshark",
  "attack shark",
  "wlmouse",
  "g-wolves",
  "endgame gear",
  "glorious",
  "zowie",
  "benq",
];

function getSelectionText(): string {
  return window.getSelection()?.toString() ?? "";
}

function scanPageCandidates(limit = 12): string[] {
  const text = document.body?.innerText ?? "";
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 64);

  const hits: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (KNOWN_HINTS.some((h) => lower.includes(h))) {
      hits.push(line);
    }
  }
  return [...new Set(hits)].slice(0, limit);
}

function pickRegion(): Promise<{
  rect: { x: number; y: number; w: number; h: number };
  dpr: number;
}> {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483646;
      cursor: crosshair; background: rgba(0,0,0,0.18);
    `;
    const box = document.createElement("div");
    box.style.cssText = `
      position: fixed; border: 2px solid #c4f54a; background: rgba(196,245,74,0.15);
      pointer-events: none; display: none;
    `;
    overlay.appendChild(box);
    document.documentElement.appendChild(overlay);

    let startX = 0;
    let startY = 0;
    let dragging = false;

    const cleanup = () => {
      overlay.remove();
      window.removeEventListener("keydown", onKey);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup();
        reject(new Error("Region selection cancelled"));
      }
    };
    window.addEventListener("keydown", onKey);

    overlay.addEventListener("mousedown", (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      box.style.display = "block";
      box.style.left = `${startX}px`;
      box.style.top = `${startY}px`;
      box.style.width = "0px";
      box.style.height = "0px";
    });

    overlay.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;
    });

    overlay.addEventListener("mouseup", (e) => {
      if (!dragging) return;
      dragging = false;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      cleanup();
      if (w < 8 || h < 8) {
        reject(new Error("Region too small"));
        return;
      }
      resolve({
        rect: { x, y, w, h },
        dpr: window.devicePixelRatio || 1,
      });
    });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SELECTION") {
    sendResponse({ text: getSelectionText() });
    return false;
  }
  if (message?.type === "SCAN_PAGE") {
    sendResponse({ candidates: scanPageCandidates() });
    return false;
  }
  if (message?.type === "PICK_REGION") {
    void pickRegion()
      .then((r) => sendResponse(r))
      .catch((e: Error) => sendResponse({ error: e.message }));
    return true;
  }
  return false;
});
