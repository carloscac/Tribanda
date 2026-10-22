import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await prisma.$queryRaw<
    { photoData: Buffer | Uint8Array | null; photoMime: string | null; updatedAt: Date }[]
  >`SELECT photoData, photoMime, updatedAt FROM Player WHERE id = ${id} LIMIT 1`;
  const row = rows[0];
  if (!row?.photoData || !row.photoMime) {
    return new NextResponse(null, { status: 404 });
  }
  const version = row.updatedAt instanceof Date ? row.updatedAt.getTime() : 0;

  return new NextResponse(new Uint8Array(row.photoData), {
    headers: {
      "Content-Type": row.photoMime,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      ETag: `"${version}"`,
    },
  });
}
