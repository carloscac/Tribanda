import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { playerPhotoSrc } from "@/lib/player-photo";
import { knockoutPrizePlaces, placeName, standingsForInscriptions, type PlayerStanding } from "@/lib/standing";

export type ShareCopy = {
  headline: string;
  firstPerson: string;
  thirdPerson: string;
  path: string;
};

type ShareFacts = {
  playerName: string;
  tournamentName: string;
  playerId: string;
  slug: string;
  kind: PlayerStanding;
  place: number | null;
};

export function shareCopy(facts: ShareFacts): ShareCopy {
  const tournament = facts.tournamentName;
  const name = facts.playerName;
  const place = facts.place;
  let headline = "Inscrito";
  let firstPerson = `Estoy inscrito en ${tournament}.`;
  let thirdPerson = `${name} se inscribió en ${tournament}.`;

  if (place === 1 || facts.kind === "champion") {
    headline = "Campeón";
    firstPerson = `Soy campeón de ${tournament}.`;
    thirdPerson = `${name} es campeón de ${tournament}.`;
  } else if (place === 2) {
    headline = "Subcampeón";
    firstPerson = `Quedé subcampeón de ${tournament}.`;
    thirdPerson = `${name} quedó subcampeón de ${tournament}.`;
  } else if (place != null && place > 2) {
    const label = placeName(place).toLowerCase();
    headline = placeName(place);
    firstPerson = `Quedé en el ${label} de ${tournament}.`;
    thirdPerson = `${name} quedó en el ${label} de ${tournament}.`;
  } else if (facts.kind === "qualified") {
    headline = "Clasificado";
    firstPerson = `Clasifiqué en ${tournament}.`;
    thirdPerson = `${name} clasificó en ${tournament}.`;
  } else if (facts.kind === "live") {
    headline = "En juego";
    firstPerson = `Estoy en juego en ${tournament}.`;
    thirdPerson = `${name} está en juego en ${tournament}.`;
  } else if (facts.kind === "grouped" || facts.kind === "tie") {
    headline = "En competencia";
    firstPerson = `Estoy compitiendo en ${tournament}.`;
    thirdPerson = `${name} está compitiendo en ${tournament}.`;
  } else if (facts.kind === "eliminated") {
    headline = "Participé";
    firstPerson = `Participé en ${tournament}.`;
    thirdPerson = `${name} participó en ${tournament}.`;
  }

  return {
    headline,
    firstPerson,
    thirdPerson,
    path: `/t/${facts.slug}/ficha/${facts.playerId}`,
  };
}

const matchSelect = {
  phase: true,
  status: true,
  closeReason: true,
  sideAId: true,
  sideBId: true,
  winnerId: true,
  nextMatchId: true,
  round: true,
  caromsA: true,
  caromsB: true,
  distanceA: true,
  distanceB: true,
  highRunA: true,
  highRunB: true,
  tournamentId: true,
} as const;

function standingOf(
  inscriptionId: string,
  members: { inscriptionId: string; qualified: boolean; group: { status: string } }[],
  matches: {
    phase: string;
    status: string;
    closeReason: string | null;
    sideAId: string | null;
    sideBId: string | null;
    winnerId: string | null;
    nextMatchId: string | null;
    round: number;
    caromsA: number | null;
    caromsB: number | null;
    distanceA: number;
    distanceB: number;
    highRunA: number | null;
    highRunB: number | null;
  }[],
  prizeSlots: number,
) {
  const info = standingsForInscriptions(
    [inscriptionId],
    members
      .filter((member) => member.inscriptionId === inscriptionId)
      .map((member) => ({
        inscriptionId,
        group: {
          settled: member.group.status === "RESOLVED",
          tie: member.group.status === "TIE",
          qualified: member.qualified,
        },
      })),
    matches,
    prizeSlots,
  ).get(inscriptionId);
  return {
    kind: info?.kind ?? ("waiting" as PlayerStanding),
    place: knockoutPrizePlaces(matches, prizeSlots).get(inscriptionId) ?? null,
  };
}

export async function shareCopiesForInscriptions(
  items: {
    inscriptionId: string;
    tournamentId: string;
    playerId: string;
    playerName: string;
    tournamentName: string;
    slug: string;
  }[],
) {
  const copies: Record<string, ShareCopy> = {};
  if (items.length === 0) return copies;
  const tournamentIds = [...new Set(items.map((item) => item.tournamentId))];
  const [matches, members, prizeRows] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId: { in: tournamentIds } },
      select: matchSelect,
    }),
    prisma.groupMember.findMany({
      where: { inscriptionId: { in: items.map((item) => item.inscriptionId) } },
      select: {
        inscriptionId: true,
        qualified: true,
        group: { select: { status: true, tournamentId: true } },
      },
    }),
    prisma.tournament.findMany({
      where: { id: { in: tournamentIds } },
      select: { id: true, _count: { select: { prizes: true } } },
    }),
  ]);
  const prizes = new Map(prizeRows.map((row) => [row.id, row._count.prizes]));

  for (const item of items) {
    const mine = matches.filter((match) => match.tournamentId === item.tournamentId);
    const standing = standingOf(
      item.inscriptionId,
      members.filter((member) => member.group.tournamentId === item.tournamentId),
      mine,
      Math.max(prizes.get(item.tournamentId) ?? 0, 8),
    );
    copies[item.inscriptionId] = shareCopy({ ...item, ...standing });
  }
  return copies;
}

export type ShareCard = ShareCopy & {
  playerName: string;
  club: string | null;
  category: string | null;
  photoUrl: string | null;
  tournamentName: string;
  venue: string | null;
  dateLabel: string | null;
};

export const loadShareCard = cache(async (slug: string, playerId: string): Promise<ShareCard | null> => {
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      venue: true,
      date: true,
      _count: { select: { prizes: true } },
    },
  });
  if (!tournament) return null;

  const inscription = await prisma.inscription.findUnique({
    where: { tournamentId_playerId: { tournamentId: tournament.id, playerId } },
    select: {
      id: true,
      player: {
        select: {
          id: true,
          name: true,
          club: true,
          photoUrl: true,
          photoMime: true,
          updatedAt: true,
        },
      },
      category: { select: { name: true } },
    },
  });
  if (!inscription) return null;

  const [matches, members] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId: tournament.id },
      select: matchSelect,
    }),
    prisma.groupMember.findMany({
      where: { inscriptionId: inscription.id },
      select: { inscriptionId: true, qualified: true, group: { select: { status: true } } },
    }),
  ]);
  const standing = standingOf(
    inscription.id,
    members,
    matches,
    Math.max(tournament._count.prizes, 8),
  );
  const copy = shareCopy({
    playerName: inscription.player.name,
    tournamentName: tournament.name,
    playerId: inscription.player.id,
    slug: tournament.slug,
    ...standing,
  });

  return {
    ...copy,
    playerName: inscription.player.name,
    club: inscription.player.club,
    category: inscription.category?.name ?? null,
    photoUrl: playerPhotoSrc(inscription.player),
    tournamentName: tournament.name,
    venue: tournament.venue,
    dateLabel: tournament.date
      ? tournament.date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })
      : null,
  };
});
