import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/lib/catalog";
import { getTallies, getYourVote } from "@/lib/votes";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const model = getModelById(id);
  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const voterId = request.headers.get("x-voter-id");
  const votes = await getTallies(id);
  const yourVote = voterId ? await getYourVote(id, voterId) : null;

  return NextResponse.json({ model, votes, yourVote });
}
