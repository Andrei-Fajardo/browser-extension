/** Override in Options later; default hits local API during development. */
export const DEFAULT_API_BASE = "http://localhost:3000";

export async function getApiBase(): Promise<string> {
  const { apiBase } = await chrome.storage.sync.get("apiBase");
  if (typeof apiBase === "string" && apiBase.trim()) {
    return apiBase.replace(/\/$/, "");
  }
  return DEFAULT_API_BASE;
}
