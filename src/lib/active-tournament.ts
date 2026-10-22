import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { tournamentDetailWhere, tournamentListWhere } from "@/lib/tournament-access";
import type { UserRole } from "@/lib/roles";

const select = {
  id: true,
  name: true,
  slug: true,
  venue: true,
  date: true,
  status: true,
} as const;

export async function getActiveTournament(access: { userId: string; role: UserRole }) {
  const { userId, role } = access;
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const fromPath = pathname.match(/^\/app\/torneos\/([^/]+)/)?.[1];
  const hinted = headerList.get("x-tournament");
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("active-tournament")?.value;
  const pathId = fromPath && fromPath !== "nuevo" ? fromPath : null;
  const hintId = hinted && hinted !== "nuevo" ? hinted : null;
  /** Middleware une path y ?torneo= en x-tournament; va primero que la cookie vieja. */
  const requested = hintId || pathId || fromCookie;

  if (requested) {
    const tournament = await prisma.tournament.findFirst({
      where: tournamentDetailWhere(requested, userId, role),
      select,
    });
    if (tournament) return tournament;
  }

  return prisma.tournament.findFirst({
    where: tournamentListWhere(userId, role),
    orderBy: { updatedAt: "desc" },
    select,
  });
}
