import { Redis } from "@upstash/redis";
import { voteRatio, type VoteTallies, type VoteValue } from "@mouse-parts/shared";

type VoteMap = Record<string, VoteValue>;

/** In-memory fallback when Upstash is not configured (local / preview). */
const globalStore = globalThis as typeof globalThis & {
  __mousePartsVotes?: Map<string, VoteMap>;
};
const memoryStore = globalStore.__mousePartsVotes ?? new Map<string, VoteMap>();
globalStore.__mousePartsVotes = memoryStore;

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function key(modelId: string): string {
  return `votes:${modelId}`;
}

async function readVotes(modelId: string): Promise<VoteMap> {
  const r = redis();
  if (!r) {
    return { ...(memoryStore.get(modelId) ?? {}) };
  }
  const data = await r.hgetall<VoteMap>(key(modelId));
  return data ?? {};
}

async function writeVote(
  modelId: string,
  voterId: string,
  value: VoteValue | null,
): Promise<VoteMap> {
  const r = redis();
  if (!r) {
    const current = { ...(memoryStore.get(modelId) ?? {}) };
    if (value === null) delete current[voterId];
    else current[voterId] = value;
    memoryStore.set(modelId, current);
    return current;
  }

  if (value === null) {
    await r.hdel(key(modelId), voterId);
  } else {
    await r.hset(key(modelId), { [voterId]: value });
  }
  return readVotes(modelId);
}

export function talliesFromMap(modelId: string, map: VoteMap): VoteTallies {
  let up = 0;
  let down = 0;
  for (const v of Object.values(map)) {
    if (v === "up") up += 1;
    else if (v === "down") down += 1;
  }
  return { modelId, up, down, ratio: voteRatio(up, down) };
}

export async function getTallies(modelId: string): Promise<VoteTallies> {
  const map = await readVotes(modelId);
  return talliesFromMap(modelId, map);
}

export async function getTalliesMany(modelIds: string[]): Promise<Record<string, VoteTallies>> {
  const out: Record<string, VoteTallies> = {};
  await Promise.all(
    modelIds.map(async (id) => {
      out[id] = await getTallies(id);
    }),
  );
  return out;
}

export async function castVote(
  modelId: string,
  voterId: string,
  value: VoteValue,
): Promise<{ tallies: VoteTallies; yourVote: VoteValue | null }> {
  const current = await readVotes(modelId);
  // Toggle off if same vote cast again
  const next = current[voterId] === value ? null : value;
  const map = await writeVote(modelId, voterId, next);
  return {
    tallies: talliesFromMap(modelId, map),
    yourVote: next,
  };
}

export async function getYourVote(
  modelId: string,
  voterId: string,
): Promise<VoteValue | null> {
  const map = await readVotes(modelId);
  return map[voterId] ?? null;
}

export function votesBackend(): "upstash" | "memory" {
  return redis() ? "upstash" : "memory";
}
