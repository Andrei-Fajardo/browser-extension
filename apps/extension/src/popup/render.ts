import type { MouseModel, PartField, SearchResult, VoteTallies, VoteValue } from "@mouse-parts/shared";
import { castVote } from "../lib/api";

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
): string {
  const rows = PART_LABELS.map(
    ({ key, label }) => `
      <div class="part-row">
        <dt>${label}</dt>
        <dd>${renderPart(model.parts[key] as PartField)}</dd>
      </div>`,
  ).join("");

  return `
    <article class="card" data-model-id="${escapeHtml(model.id)}">
      <h2>${escapeHtml(model.model)}</h2>
      <div class="brand">${escapeHtml(model.brand)}</div>
      <dl class="parts">${rows}</dl>
      <div class="votes">
        <button type="button" data-vote="up" class="${yourVote === "up" ? "active-up" : ""}">Up</button>
        <button type="button" data-vote="down" class="${yourVote === "down" ? "active-down" : ""}">Down</button>
        <span class="vote-meta" data-vote-meta>${ratioLabel(votes)}</span>
      </div>
    </article>`;
}

export function renderSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return `<p class="empty">No sourced matches. Try another query — or contribute a cited source later.</p>`;
  }
  return results.map((r) => renderModelCard(r.model, r.votes)).join("");
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
          const meta = card.querySelector("[data-vote-meta]");
          if (meta) meta.textContent = ratioLabel(tallies);
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
