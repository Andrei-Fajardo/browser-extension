function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getVoterId(): Promise<string> {
  const { voterId } = await chrome.storage.local.get("voterId");
  if (typeof voterId === "string" && voterId.length >= 8) return voterId;
  const id = randomId();
  await chrome.storage.local.set({ voterId: id });
  return id;
}
