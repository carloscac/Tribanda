import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await prisma.$queryRaw<
    { imageData: Buffer | Uint8Array | null; imageMime: string | null }[]
  >`SELECT imageData, imageMime FROM Ad WHERE id = ${id} LIMIT 1`;
  const row = rows[0];
  if (!row?.imageData || !row.imageMime) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(row.imageData), {
    headers: {
      "Content-Type": row.imageMime,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
