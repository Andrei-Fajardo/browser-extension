const DEFAULT_UA =
  "MousePartsLookupBot/0.1 (+https://github.com/Andrei-Fajardo/browser-extension; contact repo for intent)";

const ALLOWED_HOST = "www.techpowerup.com";

let lastFetchAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function hasWrittenPermission() {
  return process.env.TPU_I_HAVE_PERMISSION === "1";
}

export function assertAllowedUrl(urlString) {
  const url = new URL(urlString);
  if (url.protocol !== "https:" || url.hostname !== ALLOWED_HOST) {
    throw new Error(`Blocked host/protocol: ${urlString}`);
  }
  return url;
}

/**
 * Live fetch is gated. TechPowerUp prohibits automated scraping without
 * prior written permission (see their robots.txt / site notice).
 * Set TPU_I_HAVE_PERMISSION=1 only after you have that permission.
 */
export async function politeFetch(urlString, { delayMs = 1500 } = {}) {
  if (!hasWrittenPermission()) {
    throw new Error(
      "Live TechPowerUp fetch blocked. Their terms prohibit automated scraping without written permission. " +
        "Use --from-html with a page you saved manually, or set TPU_I_HAVE_PERMISSION=1 after obtaining permission " +
        "(contact: w1zzard@techpowerup.com).",
    );
  }

  const url = assertAllowedUrl(urlString);
  const wait = Math.max(0, delayMs - (Date.now() - lastFetchAt));
  if (wait) await sleep(wait);

  const res = await fetch(url, {
    headers: {
      "User-Agent": DEFAULT_UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  lastFetchAt = Date.now();

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.href}`);
  assertAllowedUrl(res.url);
  return {
    url: res.url,
    html: await res.text(),
    retrievedAt: new Date().toISOString(),
  };
}
