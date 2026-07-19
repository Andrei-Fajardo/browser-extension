import { NextRequest, NextResponse } from "next/server";
import type { VoteValue } from "@mouse-parts/shared";
import { getModelById } from "@/lib/catalog";
import { castVote, getTalliesMany, votesBackend } from "@/lib/votes";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Provide ids=id1,id2" }, { status: 400 });
  }

  const tallies = await getTalliesMany(ids);
  return NextResponse.json({
    backend: votesBackend(),
    votes: tallies,
  });
}

export async function POST(request: NextRequest) {
  const voterId = request.headers.get("x-voter-id")?.trim();
  if (!voterId || voterId.length < 8 || voterId.length > 128) {
    return NextResponse.json(
      { error: "Header X-Voter-Id required (8–128 chars)" },
      { status: 400 },
    );
  }

  let body: { modelId?: string; value?: VoteValue };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { modelId, value } = body;
  if (!modelId || !getModelById(modelId)) {
    return NextResponse.json({ error: "Unknown modelId" }, { status: 404 });
  }
  if (value !== "up" && value !== "down") {
    return NextResponse.json({ error: "value must be up or down" }, { status: 400 });
  }

  const result = await castVote(modelId, voterId, value);
  return NextResponse.json({
    backend: votesBackend(),
    ...result,
  });
}
