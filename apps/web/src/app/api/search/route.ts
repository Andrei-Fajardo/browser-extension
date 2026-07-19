import { NextRequest, NextResponse } from "next/server";
import { searchModels } from "@/lib/catalog";
import { getTalliesMany } from "@/lib/votes";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json(
      { error: "Missing query parameter q", results: [] },
      { status: 400 },
    );
  }

  const matches = searchModels(q);
  const tallies = await getTalliesMany(matches.map((m) => m.model.id));

  return NextResponse.json({
    query: q,
    results: matches.map(({ model, score }) => ({
      model,
      score,
      votes: tallies[model.id],
    })),
  });
}
