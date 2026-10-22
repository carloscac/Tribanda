import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const AD_ID = /^[a-zA-Z0-9_-]{8,64}$/;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!AD_ID.test(id)) return new NextResponse(null, { status: 400 });
  try {
    await prisma.$executeRaw`UPDATE Ad SET views = views + 1 WHERE id = ${id} AND active = true`;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(null, { status: 204 });
}
