import { prisma } from "@/lib/prisma";
import { PARTICIPANT_ACTIVE_TOURNAMENT_STATUSES } from "@/lib/tournament-access";

export async function loadParticipantHome(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { documentId: true },
  });

  const [inscriptions, closedInscriptions, notifications, player] = await Promise.all([
    prisma.inscription.findMany({
      where: {
        participantUserId: userId,
        tournament: { status: { in: [...PARTICIPANT_ACTIVE_TOURNAMENT_STATUSES] } },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            groupsFinalized: true,
            venue: true,
            date: true,
            imageMime: true,
            updatedAt: true,
            participantScreens: true,
            plannedCapacity: true,
            _count: { select: { inscriptions: true } },
          },
        },
        player: { select: { id: true, name: true, club: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inscription.findMany({
      where: {
        participantUserId: userId,
        tournament: { status: "CLOSED" },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            venue: true,
            date: true,
            imageMime: true,
            updatedAt: true,
            participantScreens: true,
            plannedCapacity: true,
            _count: { select: { inscriptions: true } },
          },
        },
        player: { select: { id: true, name: true, club: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.player.findFirst({
      where: user?.documentId
        ? { documentId: user.documentId }
        : { inscriptions: { some: { participantUserId: userId } } },
      include: {
        tournamentRecords: { orderBy: [{ tournamentDate: "desc" }, { createdAt: "desc" }] },
      },
    }),
  ]);

  const tournamentIds = [...new Set(inscriptions.map((i) => i.tournamentId))];
  const liveMatches = tournamentIds.length
    ? await prisma.match.findMany({
        where: {
          tournamentId: { in: tournamentIds },
          status: "LIVE",
          OR: [{ sideAId: { in: inscriptions.map((i) => i.id) } }, { sideBId: { in: inscriptions.map((i) => i.id) } }],
        },
        include: {
          table: { select: { number: true } },
          tournament: { select: { name: true } },
          sideA: { include: { player: { select: { name: true } } } },
          sideB: { include: { player: { select: { name: true } } } },
        },
      })
    : [];

  const myLive = liveMatches.filter(
    (m) => inscriptions.some((i) => i.id === m.sideAId || i.id === m.sideBId),
  );

  function byClosestDate<T extends { tournament: { date: Date | null; name: string } }>(rows: T[]) {
    return [...rows].sort((a, b) => {
      const da = a.tournament.date?.getTime();
      const db = b.tournament.date?.getTime();
      if (da == null && db == null) return a.tournament.name.localeCompare(b.tournament.name, "es");
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }

  return {
    inscriptions: byClosestDate(inscriptions),
    closedInscriptions,
    player,
    notifications,
    unreadCount: notifications.filter((n) => !n.readAt).length,
    liveMatches: myLive,
  };
}
