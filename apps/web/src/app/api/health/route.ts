import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { votesBackend } from "@/lib/votes";

export async function GET() {
  const catalog = loadCatalog();
  return NextResponse.json({
    ok: true,
    catalogVersion: catalog.version,
    modelCount: catalog.models.length,
    votesBackend: votesBackend(),
  });
}
