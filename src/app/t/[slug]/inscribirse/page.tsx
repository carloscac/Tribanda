import Link from "next/link";
import { TournamentJoinForm } from "@/components/TournamentJoinForm";
import { isParticipantLoginEmail } from "@/lib/participant-account";
import { prisma } from "@/lib/prisma";
import { requirePublicTournament } from "@/lib/public-board";
import { TournamentPaymentBox } from "@/components/TournamentPaymentBox";
import { loadTournamentPayment } from "@/lib/tournament-payment";
import {
  canSelfInscribe,
  categoryMismatchMessage,
  loadPublicJoinState,
  matchOrganizerCategory,
  tournamentRequiresPayment,
} from "@/lib/self-register";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function TournamentJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { slug } = await params;
  const { ok } = await searchParams;
  const event = await requirePublicTournament(slug);
  const tournament = await prisma.tournament.findUnique({
    where: { id: event.id },
    select: {
      id: true,
      userId: true,
      status: true,
      groupsFinalized: true,
      mix: true,
      singleCategoryId: true,
      entryFee: true,
    },
  });
  if (!tournament) return null;

  const session = await getSessionUser();
  const participant = session?.role === "PARTICIPANT" ? session : null;
  const join = await loadPublicJoinState(tournament, session);

  const categories = await prisma.category.findMany({
    where: { userId: tournament.userId, active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, distance: true },
  });

  const open = canSelfInscribe(tournament);
  const user =
    participant &&
    (await prisma.user.findUnique({
      where: { id: participant.id },
      select: { name: true, email: true, dataProcessingAcceptedAt: true },
    }));
  const playerRow =
    participant?.documentId &&
    (await prisma.player.findFirst({
      where: { documentId: participant.documentId },
      select: { id: true, phone: true },
    }));
  const playerPhone = playerRow ? playerRow.phone : undefined;
  const playerCity =
    playerRow &&
    (
      await prisma.$queryRaw<{ city: string | null }[]>`
        SELECT city FROM Player WHERE id = ${playerRow.id} LIMIT 1
      `
    )[0]?.city;
  const lockedFromPlayer = matchOrganizerCategory(categories, join.playerHint);
  const lockCategory =
    (tournament.mix === "SINGLE" && Boolean(tournament.singleCategoryId)) || Boolean(lockedFromPlayer);
  const lockedCategoryId = join.singleCategory?.id ?? lockedFromPlayer?.id ?? "";
  const lockedCategoryName = join.singleCategory?.name ?? lockedFromPlayer?.name ?? null;
  const needsPay = tournamentRequiresPayment(tournament.entryFee);
  const payment = await loadTournamentPayment(tournament.id);

  return (
    <main className="mx-auto grid max-w-md gap-5 px-4 py-6">
      <div>
        <h2 className="font-serif text-2xl">Inscribirme</h2>
        <p className="mt-1 text-sm text-muted">
          {event.name}
          {event.venue ? ` · ${event.venue}` : ""}
          {event.mix === "SINGLE" && event.singleCategoryName
            ? ` · ${event.singleCategoryName}`
            : " · Mixto"}
        </p>
      </div>

      {join.confirmed ? (
        <div className="card">
          <p className="font-semibold">Listo, ya estás inscrito.</p>
          <p className="mt-2 text-sm text-muted">El organizador confirmó tu pago.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/t/${slug}`} className="btn btn-primary">
              Ver torneo
            </Link>
            <Link href="/participante" className="btn btn-ghost">
              Mis torneos
            </Link>
          </div>
        </div>
      ) : join.pendingPayment || ok === "1" ? (
        <div className="card">
          <p className="font-semibold">Solicitud registrada.</p>
          {needsPay ? (
            <div className="mt-3">
              <TournamentPaymentBox entryFee={tournament.entryFee} payment={payment} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              El organizador verá tus datos en Deportistas del torneo.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/t/${slug}`} className="btn btn-primary">
              Ver torneo
            </Link>
            <Link href="/participante" className="btn btn-ghost">
              Mis torneos
            </Link>
          </div>
        </div>
      ) : join.blockedByCategory ? (
        <div className="card">
          <p>{categoryMismatchMessage(join.singleCategory)}</p>
          <Link href={`/t/${slug}`} className="btn btn-ghost mt-4">
            Volver
          </Link>
        </div>
      ) : !open ? (
        <div className="card">
          <p>Este torneo ya no recibe inscripciones.</p>
          <Link href={`/t/${slug}`} className="btn btn-ghost mt-4">
            Volver
          </Link>
        </div>
      ) : session && session.role !== "PARTICIPANT" ? (
        <div className="card">
          <p>Entra como jugador para inscribirte, o abre este enlace sin la sesión de organizador.</p>
          <Link href={`/entrar?rol=participante&next=${encodeURIComponent(`/t/${slug}/inscribirse`)}`} className="btn btn-primary mt-4">
            Entrar como jugador
          </Link>
        </div>
      ) : (
        <div className="card">
          <TournamentJoinForm
            tournamentId={tournament.id}
            loggedIn={Boolean(participant)}
            defaultName={user?.name}
            defaultEmail={user?.email && !isParticipantLoginEmail(user.email) ? user.email : ""}
            defaultPhone={playerPhone || ""}
            defaultCity={playerCity || ""}
            categories={categories}
            lockCategory={lockCategory}
            lockedCategoryId={lockedCategoryId}
            lockedCategoryName={lockedCategoryName}
            entryFee={tournament.entryFee}
            payment={payment}
            needsConsent={!user?.dataProcessingAcceptedAt}
          />
          {!participant ? (
            <p className="mt-4 text-sm text-muted">
              ¿Ya tienes cuenta?{" "}
              <Link
                href={`/entrar?rol=participante&next=${encodeURIComponent(`/t/${slug}/inscribirse`)}`}
                className="font-semibold text-gold"
              >
                Entra
              </Link>{" "}
              y solo completarás ciudad, correo y foto.
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}
