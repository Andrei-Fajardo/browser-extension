import * as cheerio from "cheerio";
import { politeFetch } from "./fetch.js";

const LIST_URL = "https://www.techpowerup.com/review/?category=Mice";

export async function listMouseReviews({ maxPages = 1 } = {}) {
  const urls = new Set();

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = page === 1 ? LIST_URL : `${LIST_URL}&p=${page}`;
    const { html } = await politeFetch(pageUrl);
    const $ = cheerio.load(html);
    $("a[href^='/review/']").each((_, a) => {
      const href = $(a).attr("href");
      if (!href) return;
      // Skip pagination / category noise
      if (href.includes("?")) return;
      if (!/^\/review\/[a-z0-9-]+\/$/i.test(href)) return;
      urls.add(new URL(href, "https://www.techpowerup.com").href);
    });
  }

  return [...urls];
}
