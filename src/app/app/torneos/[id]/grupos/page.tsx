import { GroupsManager } from "@/components/GroupsManager";
import { TournamentNavLoader } from "@/components/TournamentNavLoader";
import { getOrganizerTournamentContext } from "@/lib/load-organizer-tournament";
import { prisma } from "@/lib/prisma";
import {
  filterDirectPassCandidates,
  filterQualifiedForPlayIn,
  filterRepescaPool,
  filterRepescaRoster,
  filterSecondQualifiedForPlayIn,
  isConfirmedRepescaParticipant,
  parseKnockoutFillMode,
} from "@/lib/knockout-entry";
import { syncGroupQualification } from "@/lib/qualification";
import { collectAjustePools } from "@/lib/ajuste";
import { pairFirstRound } from "@/lib/bracket";
import { readGroupTiebreak } from "@/lib/group-tiebreak-db";
import { buildKnockoutPlayerList } from "@/lib/knockout-entry";
import { suggestPlayInBracketSize } from "@/lib/knockout-format";

export const dynamic = "force-dynamic";

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tournament, ownerId } = await getOrganizerTournamentContext(id);

  await syncGroupQualification(id);

  const sessionUserId = ownerId;
  const [groups, inscriptions, categories, players, hasKnockout, playedKnockout, playInRaw, tables, groupTiebreak] =
    await Promise.all([
    prisma.group.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: "asc" },
      include: {
        members: {
          include: {
            inscription: {
              include: { player: { omit: { photoData: true } }, category: true },
            },
          },
        },
        table: { select: { id: true, number: true } },
        matches: {
          include: {
            sideA: { include: { player: { omit: { photoData: true } } } },
            sideB: { include: { player: { omit: { photoData: true } } } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.inscription.findMany({
      where: { tournamentId: id },
      include: {
        player: { omit: { photoData: true } },
        category: true,
        groupMembers: { select: { qualified: true, groupId: true, seed: true } },
      },
    }),
    prisma.category.findMany({
      where: { userId: sessionUserId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.player.findMany({
      omit: { photoData: true },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.match.count({ where: { tournamentId: id, phase: "KO" } }),
    prisma.match.count({
      where: {
        tournamentId: id,
        phase: "KO",
        OR: [
          { status: "LIVE" },
          { status: "WALKOVER" },
          { status: "CLOSED", closeReason: { not: "bye" } },
        ],
      },
    }),
    prisma.match.findMany({
      where: { tournamentId: id, phase: "PLAY_IN" },
      include: {
        sideA: { include: { player: { omit: { photoData: true } } } },
        sideB: { include: { player: { omit: { photoData: true } } } },
      },
      orderBy: { bracketSlot: "asc" },
    }),
    prisma.table.findMany({
      where: { tournamentId: id },
      orderBy: { number: "asc" },
      select: { id: true, number: true },
    }),
    readGroupTiebreak(id),
  ]);

  const inscribedIds = new Set(inscriptions.map((i) => i.playerId));
  const availablePlayers = players.filter((p) => !inscribedIds.has(p.id));
  const benchInscriptions = inscriptions.filter((i) => i.groupMembers.length === 0);

  const groupQualified = groups.reduce(
    (n, g) => n + g.members.filter((m) => m.qualified).length,
    0,
  );
  const koEligible = inscriptions.filter((i) => i.koEligible).length;
  const fillMode = parseKnockoutFillMode(tournament.knockoutFillMode);
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const repescaPool = filterRepescaPool(
    inscriptions,
    groupNameById,
    tournament.repescaFee,
    tournament.groupsFinalized,
    fillMode,
  );
  const qualifiedPool = filterQualifiedForPlayIn(inscriptions, groupNameById);
  const secondQualifiedPool = filterSecondQualifiedForPlayIn(inscriptions, groupNameById);
  const repescaRoster = filterRepescaRoster(
    inscriptions,
    groupNameById,
    tournament.groupsFinalized,
    fillMode,
  );
  const manualCandidates = repescaRoster.map((c) => ({
    id: c.id,
    name: c.name,
    groupName: c.groupName,
  }));
  const directPassCandidates = filterDirectPassCandidates(inscriptions, groupNameById);

  const reencauchadoIds = new Set(
    inscriptions
      .filter((ins) =>
        isConfirmedRepescaParticipant(ins, tournament.repescaFee, tournament.groupsFinalized, fillMode),
      )
      .map((ins) => ins.id),
  );
  const ajustePools = collectAjustePools({
    groups: groups.map((g) => ({
      name: g.name,
      sortOrder: g.sortOrder,
      members: g.members,
      matches: g.matches,
    })),
    reencauchadoIds,
    groupTiebreak,
    extraReencauchados: inscriptions
      .filter((ins) => ins.groupMembers.length === 0 && reencauchadoIds.has(ins.id))
      .map((ins) => ({
        inscriptionId: ins.id,
        distance: ins.distance,
        name: ins.player.name,
      })),
  });

  const qualifiedIds = new Set(
    groups.flatMap((group) =>
      group.members.filter((member) => member.qualified).map((member) => member.inscriptionId),
    ),
  );
  const nameById = new Map(inscriptions.map((ins) => [ins.id, ins.player.name]));
  const groupNameByIns = new Map(
    inscriptions.map((ins) => {
      const groupId = ins.groupMembers[0]?.groupId;
      return [ins.id, groupId ? (groupNameById.get(groupId) ?? "") : "Sin grupo"] as const;
    }),
  );
  const bracketSize =
    fillMode === "PLAY_IN"
      ? suggestPlayInBracketSize(
          ajustePools.firsts.length + ajustePools.seconds.length,
          ajustePools.reencauchados.length,
        )
      : 32;
  const reencaucheSpots: {
    inscriptionId: string;
    name: string;
    groupName: string;
    seed: number;
    opponentName: string | null;
    opponentSeed: number | null;
  }[] = [];
  const leftOut: { inscriptionId: string; name: string; groupName: string }[] = [];
  if (fillMode === "PLAY_IN") {
    try {
      const built = await buildKnockoutPlayerList(id, fillMode, bracketSize);
      const inField = new Set(built.players.map((player) => player.inscriptionId));
      const slots = built.error ? [] : pairFirstRound(built.players, bracketSize);
      for (let i = 0; i < slots.length; i += 2) {
        const pair = [slots[i], slots[i + 1]];
        for (let side = 0; side < 2; side += 1) {
          const player = pair[side];
          if (!player || qualifiedIds.has(player.inscriptionId)) continue;
          const opponent = pair[1 - side];
          reencaucheSpots.push({
            inscriptionId: player.inscriptionId,
            name: nameById.get(player.inscriptionId) ?? "—",
            groupName: groupNameByIns.get(player.inscriptionId) ?? "",
            seed: player.overallRank ?? 0,
            opponentName: opponent ? (nameById.get(opponent.inscriptionId) ?? "—") : null,
            opponentSeed: opponent?.overallRank ?? null,
          });
        }
      }
      reencaucheSpots.sort((a, b) => a.seed - b.seed);
      for (const ins of inscriptions) {
        if (qualifiedIds.has(ins.id) || inField.has(ins.id)) continue;
        if (ins.groupMembers.length === 0 && ins.repescaOptIn !== true) continue;
        leftOut.push({
          inscriptionId: ins.id,
          name: ins.player.name,
          groupName: groupNameByIns.get(ins.id) ?? "",
        });
      }
      leftOut.sort((a, b) => a.name.localeCompare(b.name, "es"));
    } catch (err) {
      console.error("reencaucheSpots", err);
    }
  }

  const playInMatches = playInRaw
    .filter((m) => m.sideAId && m.sideBId && m.sideA && m.sideB)
    .map((m) => ({
      id: m.id,
      sideAId: m.sideAId!,
      sideBId: m.sideBId!,
      nameA: m.sideA!.player.name,
      nameB: m.sideB!.player.name,
      distanceA: m.distanceA,
      distanceB: m.distanceB,
      caromsA: m.caromsA,
      caromsB: m.caromsB,
      innings: m.innings,
      highRunA: m.highRunA,
      highRunB: m.highRunB,
      requireInnings: tournament.requireInnings,
      status: m.status,
      playInKind: m.playInKind,
    }));

  return (
    <main>
      <TournamentNavLoader id={id} current="grupos" />
      <GroupsManager
        tournamentId={id}
        tournamentName={tournament.name}
        groups={groups}
        inscriptionCount={inscriptions.length}
        checkedInCount={inscriptions.filter((i) => i.checkedIn).length}
        groupSize={tournament.groupSize}
        qualifyPerGroup={tournament.qualifyPerGroup}
        groupTiebreak={groupTiebreak}
        knockoutLayout={tournament.knockoutLayout}
        hasKnockout={hasKnockout > 0}
        canRegenerateKnockout={playedKnockout === 0}
        categories={categories}
        availablePlayers={availablePlayers}
        benchInscriptions={benchInscriptions}
        requireInnings={tournament.requireInnings}
        knockoutFillMode={fillMode}
        groupQualified={groupQualified}
        koEligible={koEligible}
        manualCandidates={manualCandidates}
        playInMatches={playInMatches}
        repescaPool={repescaPool}
        qualifiedPool={qualifiedPool}
        secondQualifiedPool={secondQualifiedPool}
        repescaRoster={repescaRoster}
        repescaFee={tournament.repescaFee}
        groupsFinalized={tournament.groupsFinalized}
        plannedCapacity={tournament.plannedCapacity}
        knockoutPreDraw={tournament.knockoutPreDraw}
        directPassCandidates={directPassCandidates}
        tables={tables}
        ajusteFirsts={ajustePools.firsts}
        ajusteSeconds={ajustePools.seconds}
        ajusteReencauchados={ajustePools.reencauchados}
        reencaucheSpots={reencaucheSpots}
        reencaucheLeftOut={leftOut}
      />
    </main>
  );
}
