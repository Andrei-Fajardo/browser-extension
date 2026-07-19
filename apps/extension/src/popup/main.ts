import { fetchCommunity, healthCheck, searchModels } from "../lib/api";
import { bindVoteButtons, renderModelCard, renderSearchResults } from "./render";

type TabId = "search" | "page" | "community";

const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchStatus = document.getElementById("search-status") as HTMLElement;
const searchResults = document.getElementById("search-results") as HTMLElement;
const pageStatus = document.getElementById("page-status") as HTMLElement;
const pageResults = document.getElementById("page-results") as HTMLElement;
const pageQuery = document.getElementById("page-query") as HTMLInputElement;
const communityList = document.getElementById("community-list") as HTMLElement;
const communityStatus = document.getElementById("community-status") as HTMLElement;

let searchTimer: ReturnType<typeof setTimeout> | undefined;

function setTab(tab: TabId): void {
  document.querySelectorAll(".tab").forEach((el) => {
    el.classList.toggle("active", (el as HTMLElement).dataset.tab === tab);
  });
  document.querySelectorAll(".panel").forEach((el) => {
    el.classList.toggle("active", el.id === `panel-${tab}`);
  });
  if (tab === "community") void loadCommunity();
}

async function runSearch(query: string, statusEl: HTMLElement, resultsEl: HTMLElement): Promise<void> {
  const q = query.trim();
  if (!q) {
    resultsEl.innerHTML = "";
    statusEl.textContent = "";
    return;
  }
  statusEl.textContent = "Searching sourced catalog…";
  try {
    const results = await searchModels(q);
    resultsEl.innerHTML = renderSearchResults(results);
    bindVoteButtons(resultsEl);
    statusEl.textContent =
      results.length === 0
        ? "No sourced matches."
        : `${results.length} match${results.length === 1 ? "" : "es"}`;
  } catch (e) {
    resultsEl.innerHTML = "";
    statusEl.textContent =
      e instanceof Error
        ? e.message
        : "API unreachable. Start the local API or set apiBase in storage.";
  }
}

async function loadCommunity(): Promise<void> {
  communityStatus.textContent = "Loading community signals…";
  try {
    const items = await fetchCommunity();
    if (items.length === 0) {
      communityList.innerHTML = `<p class="empty">No votes yet. Search a model and cast Up/Down to start the feed.</p>`;
      communityStatus.textContent = "";
      return;
    }
    communityList.innerHTML = items
      .map((item) => renderModelCard(item.model, item.votes))
      .join("");
    bindVoteButtons(communityList);
    communityStatus.textContent = `${items.length} models with votes`;
  } catch (e) {
    communityStatus.textContent = e instanceof Error ? e.message : "Failed to load community";
  }
}

function sendToActiveTab(message: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId == null) {
        reject(new Error("No active tab"));
        return;
      }
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  });
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setTab((tab as HTMLElement).dataset.tab as TabId));
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void runSearch(searchInput.value, searchStatus, searchResults);
  }, 220);
});

document.getElementById("btn-lookup-selection")?.addEventListener("click", async () => {
  pageStatus.textContent = "Reading selection…";
  try {
    const res = (await sendToActiveTab({ type: "GET_SELECTION" })) as { text?: string };
    const text = res?.text?.trim() ?? "";
    pageQuery.value = text;
    if (!text) {
      pageStatus.textContent = "No text selected on the page.";
      return;
    }
    await runSearch(text, pageStatus, pageResults);
  } catch (e) {
    pageStatus.textContent = e instanceof Error ? e.message : "Could not read selection";
  }
});

document.getElementById("btn-scan-page")?.addEventListener("click", async () => {
  pageStatus.textContent = "Scanning visible text…";
  try {
    const res = (await sendToActiveTab({ type: "SCAN_PAGE" })) as { candidates?: string[] };
    const candidates = res?.candidates ?? [];
    if (candidates.length === 0) {
      pageStatus.textContent = "No mouse-like names found on this page.";
      pageResults.innerHTML = "";
      return;
    }
    pageQuery.value = candidates[0] ?? "";
    pageStatus.textContent = `Candidates: ${candidates.slice(0, 5).join(" · ")}`;
    await runSearch(pageQuery.value, pageStatus, pageResults);
  } catch (e) {
    pageStatus.textContent = e instanceof Error ? e.message : "Scan failed";
  }
});

document.getElementById("btn-region-ocr")?.addEventListener("click", () => {
  pageStatus.textContent = "Popup may close — draw a region on the page, then reopen the extension.";
  setTab("page");
  // Fire-and-forget: result lands in session storage for the next popup open.
  void chrome.runtime.sendMessage({ type: "START_REGION_OCR" });
  window.close();
});

document.getElementById("btn-search-page-query")?.addEventListener("click", () => {
  void runSearch(pageQuery.value, pageStatus, pageResults);
});

void (async () => {
  const ok = await healthCheck();
  if (!ok) {
    searchStatus.textContent = "API offline — run npm run dev:api (localhost:3000)";
  }

  const session = await chrome.storage.session.get([
    "pendingPageQuery",
    "ocrStatus",
    "ocrError",
    "lastLookup",
    "lastLookupError",
  ]);

  if (typeof session.pendingPageQuery === "string" && session.pendingPageQuery) {
    setTab("page");
    pageQuery.value = session.pendingPageQuery;
    if (session.ocrStatus === "done") {
      pageStatus.textContent = "OCR text ready — confirm, then search.";
    } else if (session.lastLookupError) {
      pageStatus.textContent = String(session.lastLookupError);
    }
    await chrome.storage.session.remove(["pendingPageQuery", "ocrStatus", "ocrError"]);
  } else if (session.ocrError) {
    setTab("page");
    pageStatus.textContent = String(session.ocrError);
    await chrome.storage.session.remove(["ocrStatus", "ocrError"]);
  }
});
