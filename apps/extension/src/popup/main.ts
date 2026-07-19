import { fetchCommunity, healthCheck, searchModels } from "../lib/api";
import { bindVoteButtons, renderEmptyState, renderModelCard, renderSearchResults, renderSkeletons } from "./render";

type TabId = "search" | "page" | "community";

const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchStatus = document.getElementById("search-status") as HTMLElement;
const searchResults = document.getElementById("search-results") as HTMLElement;
const pageStatus = document.getElementById("page-status") as HTMLElement;
const pageResults = document.getElementById("page-results") as HTMLElement;
const pageQuery = document.getElementById("page-query") as HTMLInputElement;
const communityList = document.getElementById("community-list") as HTMLElement;
const communityStatus = document.getElementById("community-status") as HTMLElement;
const apiDot = document.getElementById("api-dot") as HTMLElement;
const tabIndicator = document.querySelector(".tab-indicator") as HTMLElement | null;

let searchTimer: ReturnType<typeof setTimeout> | undefined;

function moveIndicatorTo(tabEl: HTMLElement): void {
  if (!tabIndicator) return;
  tabIndicator.style.width = `${tabEl.offsetWidth}px`;
  tabIndicator.style.transform = `translateX(${tabEl.offsetLeft - 4}px)`;
}

function setTab(tab: TabId): void {
  document.querySelectorAll<HTMLElement>(".tab").forEach((el) => {
    const isActive = el.dataset.tab === tab;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-selected", String(isActive));
    if (isActive) moveIndicatorTo(el);
  });
  document.querySelectorAll(".panel").forEach((el) => {
    el.classList.toggle("active", el.id === `panel-${tab}`);
  });
  if (tab === "community") void loadCommunity();
}

function setStatus(el: HTMLElement, text: string, loading = false): void {
  el.textContent = text;
  el.classList.toggle("loading", loading && Boolean(text));
}

async function runSearch(query: string, statusEl: HTMLElement, resultsEl: HTMLElement): Promise<void> {
  const q = query.trim();
  if (!q) {
    resultsEl.innerHTML = "";
    setStatus(statusEl, "");
    return;
  }
  setStatus(statusEl, "Searching sourced catalog…", true);
  resultsEl.innerHTML = renderSkeletons(3);
  try {
    const results = await searchModels(q);
    resultsEl.innerHTML = renderSearchResults(results);
    bindVoteButtons(resultsEl);
    setStatus(
      statusEl,
      results.length === 0
        ? "No sourced matches."
        : `${results.length} match${results.length === 1 ? "" : "es"}`,
    );
  } catch (e) {
    resultsEl.innerHTML = renderEmptyState("API unreachable", "Start the local API or check your connection.");
    setStatus(
      statusEl,
      e instanceof Error
        ? e.message
        : "API unreachable. Start the local API or set apiBase in storage.",
    );
  }
}

async function loadCommunity(): Promise<void> {
  setStatus(communityStatus, "Loading community signals…", true);
  communityList.innerHTML = renderSkeletons(2);
  try {
    const items = await fetchCommunity();
    if (items.length === 0) {
      communityList.innerHTML = renderEmptyState(
        "No votes yet",
        "Search a model and cast Up/Down to start the feed.",
      );
      setStatus(communityStatus, "");
      return;
    }
    communityList.innerHTML = items
      .map((item, i) => renderModelCard(item.model, item.votes, null, i))
      .join("");
    bindVoteButtons(communityList);
    setStatus(communityStatus, `${items.length} model${items.length === 1 ? "" : "s"} with votes`);
  } catch (e) {
    communityList.innerHTML = renderEmptyState("Couldn't load community", "Check the API connection and try again.");
    setStatus(communityStatus, e instanceof Error ? e.message : "Failed to load community");
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

// Position the sliding tab indicator once layout is ready.
requestAnimationFrame(() => {
  const activeTab = document.querySelector<HTMLElement>(".tab.active");
  if (activeTab) moveIndicatorTo(activeTab);
});

void (async () => {
  const ok = await healthCheck();
  apiDot.classList.add(ok ? "online" : "offline");
  apiDot.title = ok ? "API online" : "API offline";
  if (!ok) {
    setStatus(searchStatus, "API offline — run npm run dev:api (localhost:3000)");
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
