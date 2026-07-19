import { URL } from "node:url";

const DEFAULT_UA =
  "MousePartsLookupBot/0.1 (+https://github.com/Andrei-Fajardo/browser-extension; respectful catalog research)";

/** @type {Map<string, { fetchedAt: number, groups: Array<{ agents: string[], disallow: string[] }> }>} */
const robotsCache = new Map();
const lastFetchByHost = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRobots(text) {
  /** @type {Array<{ agents: string[], disallow: string[] }>} */
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || current.disallow.length > 0 || current.agents.length === 0) {
        // start new group when disallow already started, else accumulate agents
      }
      if (!current || current.disallow.length > 0) {
        current = { agents: [value.toLowerCase()], disallow: [] };
        groups.push(current);
      } else {
        current.agents.push(value.toLowerCase());
      }
    } else if (key === "disallow" && current) {
      current.disallow.push(value);
    }
  }
  return groups;
}

function escapeRegex(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function ruleBlocks(pathname, search, pattern) {
  if (!pattern) return false; // empty Disallow = allow all
  if (pattern === "/") return true;

  const full = pathname + (search || "");

  // Express robots wildcards: * = any, $ = end (rare here)
  if (pattern.includes("*") || pattern.includes("$") || pattern.includes("?")) {
    let reBody = "";
    for (const ch of pattern) {
      if (ch === "*") reBody += ".*";
      else if (ch === "$") reBody += "$";
      else if (ch === "?") reBody += "\\?";
      else reBody += escapeRegex(ch);
    }
    if (!pattern.endsWith("$")) {
      // prefix-style: pattern may match start of path or path+query
    }
    const re = new RegExp("^" + reBody);
    return re.test(pathname) || re.test(full);
  }

  return pathname.startsWith(pattern) || full.startsWith(pattern);
}

function pathDisallowed(pathname, search, groups) {
  const applicable =
    groups.filter((g) => g.agents.includes("*")) ||
    groups;
  const starGroups = groups.filter((g) => g.agents.includes("*"));
  const use = starGroups.length ? starGroups : groups;

  for (const g of use) {
    for (const d of g.disallow) {
      if (ruleBlocks(pathname, search, d)) return true;
    }
  }
  return false;
}

async function loadRobots(origin) {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) return cached;
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": DEFAULT_UA },
    });
    const text = res.ok ? await res.text() : "User-agent: *\nDisallow:\n";
    const entry = { fetchedAt: Date.now(), groups: parseRobots(text) };
    robotsCache.set(origin, entry);
    return entry;
  } catch {
    const entry = { fetchedAt: Date.now(), groups: [] };
    robotsCache.set(origin, entry);
    return entry;
  }
}

/**
 * Polite allowlisted fetch with robots.txt checks.
 * @param {string} urlString
 * @param {{ allowHosts: string[], delayMs?: number }} opts
 */
export async function politeFetch(urlString, { allowHosts, delayMs = 1200 } = {}) {
  const url = new URL(urlString);
  if (url.protocol !== "https:") throw new Error(`HTTPS only: ${urlString}`);
  if (!allowHosts.includes(url.hostname)) {
    throw new Error(`Host not allowlisted: ${url.hostname}`);
  }

  const robots = await loadRobots(url.origin);
  if (pathDisallowed(url.pathname, url.search, robots.groups)) {
    throw new Error(`robots.txt disallows ${url.pathname}${url.search}`);
  }

  const last = lastFetchByHost.get(url.hostname) ?? 0;
  const wait = Math.max(0, delayMs - (Date.now() - last));
  if (wait) await sleep(wait);

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": DEFAULT_UA,
          Accept: "text/html,application/xhtml+xml,application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      lastFetchByHost.set(url.hostname, Date.now());

      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.href}`);
      const finalUrl = new URL(res.url);
      if (!allowHosts.includes(finalUrl.hostname)) {
        throw new Error(`Redirected off allowlist: ${finalUrl.hostname}`);
      }

      const finalRobots = await loadRobots(finalUrl.origin);
      if (pathDisallowed(finalUrl.pathname, finalUrl.search, finalRobots.groups)) {
        throw new Error(`robots.txt disallows redirect target ${finalUrl.pathname}`);
      }

      return {
        url: finalUrl.href,
        html: await res.text(),
        retrievedAt: new Date().toISOString(),
      };
    } catch (e) {
      lastErr = e;
      lastFetchByHost.set(url.hostname, Date.now());
      if (attempt < 3) await sleep(800 * attempt);
    }
  }
  throw lastErr;
}
