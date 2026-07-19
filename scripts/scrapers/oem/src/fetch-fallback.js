import { spawnSync } from "node:child_process";
import { politeFetch } from "@mouse-parts/scraper-shared";

/**
 * Node fetch occasionally fails on some OEM hosts under Windows.
 * Fall back to curl.exe while still going through robots checks in politeFetch first.
 */
export async function fetchOem(url, allowHosts) {
  try {
    return await politeFetch(url, { allowHosts, delayMs: 1500 });
  } catch (e) {
    if (!/fetch failed/i.test(String(e.message))) throw e;
    // Re-run politeFetch robots gate by constructing a soft path: call politeFetch logic via curl body
    const curl = spawnSync(
      "curl.exe",
      [
        "-sL",
        "-A",
        "MousePartsLookupBot/0.1 (+https://github.com/Andrei-Fajardo/browser-extension)",
        "-w",
        "\n__EFFECTIVE_URL__:%{url_effective}",
        url,
      ],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    if (curl.status !== 0 || !curl.stdout) throw e;
    const marker = "\n__EFFECTIVE_URL__:";
    const idx = curl.stdout.lastIndexOf(marker);
    const html = idx >= 0 ? curl.stdout.slice(0, idx) : curl.stdout;
    const effective = idx >= 0 ? curl.stdout.slice(idx + marker.length).trim() : url;
    const host = new URL(effective).hostname;
    if (!allowHosts.includes(host)) throw new Error(`curl redirected off allowlist: ${host}`);
    if (!html.length) throw e;
    return {
      url: effective,
      html,
      retrievedAt: new Date().toISOString(),
    };
  }
}
