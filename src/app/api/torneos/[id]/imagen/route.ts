import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await prisma.tournament.findUnique({
    where: { id },
    select: { imageData: true, imageMime: true, updatedAt: true },
  });
  if (!row?.imageData || !row.imageMime) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(row.imageData), {
    headers: {
      "Content-Type": row.imageMime,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      ETag: `"${row.updatedAt.getTime()}"`,
    },
  });
}
