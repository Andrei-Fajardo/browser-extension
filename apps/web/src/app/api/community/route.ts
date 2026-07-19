import { NextResponse } from "next/server";
import { getAllModels } from "@/lib/catalog";
import { getTalliesMany } from "@/lib/votes";

/** Community leaderboard: models sorted by engagement / veracity signal. */
export async function GET() {
  const models = getAllModels();
  const tallies = await getTalliesMany(models.map((m) => m.id));

  const rows = models
    .map((model) => {
      const votes = tallies[model.id];
      const total = votes.up + votes.down;
      return { model, votes, total };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => {
      const ratioA = a.votes.ratio ?? 0;
      const ratioB = b.votes.ratio ?? 0;
      if (b.total !== a.total) return b.total - a.total;
      return ratioB - ratioA;
    });

  return NextResponse.json({
    items: rows.map(({ model, votes }) => ({
      model,
      votes,
    })),
  });
}
