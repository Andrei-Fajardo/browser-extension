import type { MouseModel, SearchResult, VoteTallies, VoteValue } from "@mouse-parts/shared";
import { getApiBase } from "./config";
import { getVoterId } from "./voter";

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = await getApiBase();
  const voterId = await getVoterId();
  const headers = new Headers(init?.headers);
  headers.set("X-Voter-Id", voterId);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${base}${path}`, { ...init, headers });
}

export async function searchModels(query: string): Promise<SearchResult[]> {
  const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Search failed (${res.status})`);
  }
  const data = (await res.json()) as { results: SearchResult[] };
  return data.results;
}

export async function getModel(id: string): Promise<{
  model: MouseModel;
  votes: VoteTallies;
  yourVote: VoteValue | null;
}> {
  const res = await apiFetch(`/api/models/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Model not found`);
  return res.json();
}

export async function castVote(
  modelId: string,
  value: VoteValue,
): Promise<{ tallies: VoteTallies; yourVote: VoteValue | null }> {
  const res = await apiFetch("/api/votes", {
    method: "POST",
    body: JSON.stringify({ modelId, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Vote failed");
  }
  return res.json();
}

export async function fetchCommunity(): Promise<
  Array<{ model: MouseModel; votes: VoteTallies }>
> {
  const res = await apiFetch("/api/community");
  if (!res.ok) throw new Error("Community feed unavailable");
  const data = (await res.json()) as {
    items: Array<{ model: MouseModel; votes: VoteTallies }>;
  };
  return data.items;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
