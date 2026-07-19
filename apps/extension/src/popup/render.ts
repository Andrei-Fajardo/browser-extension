import type { MouseModel, PartField, SearchResult, VoteTallies, VoteValue } from "@mouse-parts/shared";
import { castVote } from "../lib/api";

const PART_ICONS: Record<string, string> = {
  mainSwitches: `<svg viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="12" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M9 11v5m6-5v5M12 16v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  sideSwitches: `<svg viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="18" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M9 9h-2.5a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H9" stroke="currentColor" stroke-width="1.6"/></svg>`,
  encoder: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  sensor: `<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6"/></svg>`,
  mcu: `<svg viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M9 6V3.5M15 6V3.5M9 20.5V18M15 20.5V18M6 9H3.5M6 15H3.5M20.5 9H18M20.5 15H18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
};

const THUMB_UP_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4.2-8a2 2 0 0 1 3.6 1.7L13.8 9H19a2 2 0 0 1 1.94 2.47l-1.5 6A2 2 0 0 1 17.5 19H10a3 3 0 0 1-3-3v-5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const THUMB_DOWN_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4.2 8a2 2 0 0 1-3.6-1.7L10.2 15H5a2 2 0 0 1-1.94-2.47l1.5-6A2 2 0 0 1 6.5 5H14a3 3 0 0 1 3 3v5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const EMPTY_ICON = `<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.6"/><line x1="20" y1="20" x2="15.8" y2="15.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="8.5" y1="11" x2="13.5" y2="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

const PART_LABELS: Array<{ key: keyof MouseModel["parts"]; label: string }> = [
  { key: "mainSwitches", label: "Main switches" },
  { key: "sideSwitches", label: "Side switches" },
  { key: "encoder", label: "Encoder" },
  { key: "sensor", label: "Sensor" },
  { key: "mcu", label: "MCU" },
];

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPart(field: PartField): string {
  if (!field.value) {
    return `<span class="unknown">Unknown</span>`;
  }
  const sources = field.sources
    .map(
      (s) =>
        `<a href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer">${escapeHtml(s.title ?? "source")}</a>`,
    )
    .join(" · ");
  return `${escapeHtml(field.value)}${sources ? ` <span>(${sources})</span>` : ""}`;
}

function ratioLabel(votes: VoteTallies): string {
  if (votes.ratio === null) return "No votes yet";
  return `${Math.round(votes.ratio * 100)}% up · ${votes.up}↑ ${votes.down}↓`;
}

export function renderModelCard(
  model: MouseModel,
  votes: VoteTallies,
  yourVote: VoteValue | null = null,
  index = 0,
): string {
  const rows = PART_LABELS.map(
    ({ key, label }) => `
      <div class="part-row">
        <span class="part-icon">${PART_ICONS[key] ?? ""}</span>
        <dt>${label}</dt>
        <dd>${renderPart(model.parts[key] as PartField)}</dd>
      </div>`,
  ).join("");

  return `
    <article class="card" data-model-id="${escapeHtml(model.id)}" style="animation-delay:${Math.min(index, 8) * 55}ms">
      <h2>${escapeHtml(model.model)}</h2>
      <div class="brand">${escapeHtml(model.brand)}</div>
      <dl class="parts">${rows}</dl>
      <div class="votes">
        <button type="button" data-vote="up" class="vote-btn ${yourVote === "up" ? "active-up" : ""}" aria-label="Mark helpful">${THUMB_UP_ICON}<span>Helpful</span></button>
        <button type="button" data-vote="down" class="vote-btn ${yourVote === "down" ? "active-down" : ""}" aria-label="Mark inaccurate">${THUMB_DOWN_ICON}<span>Off</span></button>
        <span class="vote-meta" data-vote-meta>${ratioLabel(votes)}</span>
      </div>
    </article>`;
}

export function renderSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return renderEmptyState("No sourced matches", "Try another query — or contribute a cited source later.");
  }
  return results.map((r, i) => renderModelCard(r.model, r.votes, null, i)).join("");
}

export function renderEmptyState(title: string, subtitle: string): string {
  return `
    <div class="empty">
      <span class="empty-icon">${EMPTY_ICON}</span>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </div>`;
}

export function renderSkeletons(count = 2): string {
  return Array.from({ length: count })
    .map(
      (_, i) => `
      <div class="skeleton-card" style="animation-delay:${i * 70}ms">
        <div class="skeleton-line w-60"></div>
        <div class="skeleton-line w-40"></div>
        <div class="skeleton-line w-90"></div>
        <div class="skeleton-line w-70"></div>
        <div class="skeleton-line w-50"></div>
      </div>`,
    )
    .join("");
}

export function bindVoteButtons(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".card[data-model-id]").forEach((card) => {
    const modelId = card.dataset.modelId;
    if (!modelId) return;
    card.querySelectorAll<HTMLButtonElement>("button[data-vote]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const value = btn.dataset.vote as VoteValue;
        btn.disabled = true;
        try {
          const { tallies, yourVote } = await castVote(modelId, value);
          const meta = card.querySelector<HTMLElement>("[data-vote-meta]");
          if (meta) {
            meta.textContent = ratioLabel(tallies);
            meta.classList.remove("bump");
            requestAnimationFrame(() => meta.classList.add("bump"));
          }
          card.querySelectorAll<HTMLButtonElement>("button[data-vote]").forEach((b) => {
            b.classList.remove("active-up", "active-down");
            if (yourVote && b.dataset.vote === yourVote) {
              b.classList.add(yourVote === "up" ? "active-up" : "active-down");
            }
          });
        } catch (e) {
          console.error(e);
        } finally {
          btn.disabled = false;
        }
      });
    });
  });
}
