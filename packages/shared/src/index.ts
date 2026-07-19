export type Confidence = "verified" | "sourced" | "community" | "unknown";

export type VoteValue = "up" | "down";

export interface SourceRef {
  url: string;
  title?: string;
  retrievedAt: string;
}

export interface PartField {
  /** Null means unknown — never invent a value. */
  value: string | null;
  confidence: Confidence;
  sources: SourceRef[];
  notes?: string;
}

export interface MouseParts {
  mainSwitches: PartField;
  sideSwitches: PartField;
  encoder: PartField;
  sensor: PartField;
  mcu: PartField;
  other?: Record<string, PartField>;
}

export interface MouseModel {
  id: string;
  brand: string;
  model: string;
  aliases: string[];
  parts: MouseParts;
  updatedAt: string;
}

export interface VoteTallies {
  modelId: string;
  up: number;
  down: number;
  /** up / (up + down), or null if no votes */
  ratio: number | null;
}

export interface SearchResult {
  model: MouseModel;
  score: number;
  votes: VoteTallies;
}

export function emptyPartField(): PartField {
  return {
    value: null,
    confidence: "unknown",
    sources: [],
  };
}

export function emptyParts(): MouseParts {
  return {
    mainSwitches: emptyPartField(),
    sideSwitches: emptyPartField(),
    encoder: emptyPartField(),
    sensor: emptyPartField(),
    mcu: emptyPartField(),
  };
}

export function voteRatio(up: number, down: number): number | null {
  const total = up + down;
  if (total === 0) return null;
  return up / total;
}
