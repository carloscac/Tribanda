import { formatCOP } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import {
  loadTournamentPayment,
  paymentInstructionLine,
  type TournamentPayment,
} from "@/lib/tournament-payment";
import { sendWhatsAppText } from "@/lib/whatsapp";

function buildMatchOnTableBody(tournamentName: string, tableLabel: string, opponent: string, resend: boolean) {
  const line = `${tournamentName}: ${tableLabel} contra ${opponent}.`;
  return resend ? `${line} (recordatorio del organizador)` : line;
}

export async function notifyMatchOnTable(matchId: string, opts?: { resend?: boolean }) {
  const resend = opts?.resend === true;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { id: true, name: true } },
      table: { select: { number: true } },
      sideA: { include: { player: { select: { name: true, phone: true } } } },
      sideB: { include: { player: { select: { name: true, phone: true } } } },
    },
  });
  if (!match?.table || match.status !== "LIVE") return;

  const tableLabel = `Mesa ${match.table.number}`;
  const opponentA = match.sideB?.player.name ?? "rival";
  const opponentB = match.sideA?.player.name ?? "rival";

  const rows: { inscriptionId: string; userId: string; opponent: string; phone: string | null }[] = [];

  if (match.sideAId) {
    const ins = await prisma.inscription.findUnique({
      where: { id: match.sideAId },
      select: { id: true, participantUserId: true },
    });
    if (ins?.participantUserId) {
      rows.push({
        inscriptionId: ins.id,
        userId: ins.participantUserId,
        opponent: opponentA,
        phone: match.sideA?.player.phone ?? null,
      });
    }
  }
  if (match.sideBId) {
    const ins = await prisma.inscription.findUnique({
      where: { id: match.sideBId },
      select: { id: true, participantUserId: true },
    });
    if (ins?.participantUserId) {
      rows.push({
        inscriptionId: ins.id,
        userId: ins.participantUserId,
        opponent: opponentB,
        phone: match.sideB?.player.phone ?? null,
      });
    }
  }

  for (const row of rows) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: row.userId,
        matchId: match.id,
        kind: "MATCH_ON_TABLE",
      },
    });
    const body = buildMatchOnTableBody(match.tournament.name, tableLabel, row.opponent, resend);

    if (existing) {
      if (!resend) continue;
      await prisma.notification.update({
        where: { id: existing.id },
        data: {
          readAt: null,
          createdAt: new Date(),
          title: "Te toca jugar",
          body,
        },
      });
      void sendWhatsAppText(row.phone, body).catch((err) => console.error("whatsapp", err));
      continue;
    }

    await prisma.notification.create({
      data: {
        userId: row.userId,
        tournamentId: match.tournamentId,
        inscriptionId: row.inscriptionId,
        matchId: match.id,
        kind: "MATCH_ON_TABLE",
        title: "Te toca jugar",
        body,
      },
    });
    void sendWhatsAppText(row.phone, body).catch((err) => console.error("whatsapp", err));
  }
}

export async function notifyTournamentCreated(opts: {
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string;
  venue: string | null;
  organizerName: string;
}) {
  const participants = await prisma.user.findMany({
    where: { role: "PARTICIPANT", active: true },
    select: { id: true },
  });
  if (participants.length === 0) return;

  const venue = opts.venue ? ` en ${opts.venue}` : "";
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") ?? "";
  const link = appUrl ? ` ${appUrl}/t/${opts.tournamentSlug}` : "";
  const body = `${opts.organizerName} abrió «${opts.tournamentName}»${venue}.${link}`;

  await prisma.notification.createMany({
    data: participants.map((row) => ({
      userId: row.id,
      tournamentId: opts.tournamentId,
      kind: "TOURNAMENT_CREATED",
      title: "Nuevo torneo",
      body,
    })),
  });

  try {
    const phones = await prisma.$queryRaw<{ id: string; phone: string | null }[]>`
      SELECT u.id AS id, COALESCE(u.phone, p.phone) AS phone
      FROM User u
      LEFT JOIN Player p ON p.documentId = u.documentId
      WHERE u.role = 'PARTICIPANT' AND u.active = 1
    `;
    for (const row of phones) {
      if (!row.phone) continue;
      void sendWhatsAppText(row.phone, body).catch((err) => console.error("whatsapp", err));
    }
  } catch (err) {
    console.error("notifyTournamentCreated phones", err);
  }
}

export async function notifyInscriptionConfirmed(opts: {
  tournamentId: string;
  tournamentName: string;
  playerName: string;
  playerCode: string | null;
  phone: string | null;
  paid: boolean;
  entryFee: number | null;
  participantUserId?: string | null;
  inscriptionId?: string | null;
  payment?: TournamentPayment | null;
}) {
  const code = opts.playerCode ? ` Código ${opts.playerCode}.` : "";
  const pay =
    !opts.paid && opts.entryFee != null && opts.entryFee > 0
      ? ` Pendiente de pago ${formatCOP(opts.entryFee)}.`
      : " Inscripción confirmada.";
  const dest = paymentInstructionLine(opts.payment);
  const body = `${opts.playerName}, quedaste en «${opts.tournamentName}».${code}${pay}${dest}`;

  if (opts.participantUserId) {
    await prisma.notification.create({
      data: {
        userId: opts.participantUserId,
        tournamentId: opts.tournamentId,
        inscriptionId: opts.inscriptionId ?? undefined,
        kind: "INSCRIPTION",
        title: opts.paid ? "Inscripción confirmada" : "Solicitud de inscripción",
        body,
      },
    });
  }

  void sendWhatsAppText(opts.phone, body).catch((err) => console.error("whatsapp", err));
}

export async function notifyInscriptionForPlayer(opts: {
  tournamentId: string;
  tournamentName: string;
  playerId: string;
  paid: boolean;
  entryFee: number | null;
}) {
  const player = await prisma.player.findUnique({
    where: { id: opts.playerId },
    select: { name: true, code: true, phone: true, documentId: true },
  });
  if (!player) return;

  const inscription = await prisma.inscription.findFirst({
    where: { tournamentId: opts.tournamentId, playerId: opts.playerId },
    select: { id: true, participantUserId: true },
  });

  const payment = await loadTournamentPayment(opts.tournamentId);
  await notifyInscriptionConfirmed({
    tournamentId: opts.tournamentId,
    tournamentName: opts.tournamentName,
    playerName: player.name,
    playerCode: player.code,
    phone: player.phone,
    paid: opts.paid,
    entryFee: opts.entryFee,
    participantUserId: inscription?.participantUserId,
    inscriptionId: inscription?.id,
    payment,
  });
}
