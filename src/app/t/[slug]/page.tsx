import Link from "next/link";
import { PublicFloor } from "@/components/public/PublicFloor";
import { PublicLeaders } from "@/components/public/PublicStats";
import {
  assertParticipantScreenVisible,
  resolveVisibleParticipantScreens,
} from "@/lib/participant-screens";
import { loadPublicFloor, loadPublicStats, requirePublicTournament } from "@/lib/public-board";
import { categoryMismatchMessage, loadPublicJoinState } from "@/lib/self-register";
import { getSessionUser } from "@/lib/session-user";
import { TournamentPaymentBox } from "@/components/TournamentPaymentBox";
import { formatCOP } from "@/lib/labels";
import { phasePublicHref } from "@/lib/tournament-phase";

export default async function PublicHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await requirePublicTournament(slug);
  await assertParticipantScreenVisible(event.userId, event.participantScreens, "inicio");
  const visible = await resolveVisibleParticipantScreens(event.userId, event.participantScreens);
  const session = await getSessionUser();
  const join = await loadPublicJoinState(event, session);
  const [floor, stats] = await Promise.all([
    loadPublicFloor(event.id),
    loadPublicStats(event.id),
  ]);
  const live = floor.tables.filter((table) => table.match).length;

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-6">
      {event.status === "LIVE" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-felt/40 bg-felt/10 px-4 py-3">
          <p className="text-sm">
            Este torneo está en <strong>{event.currentPhase.label}</strong>.
          </p>
          {event.currentPhase.hrefKey !== "inicio" ? (
            <Link
              href={phasePublicHref(event.slug, event.currentPhase, visible)}
              className="btn btn-primary"
            >
              {event.currentPhase.hrefKey === "grupos"
                ? "Ir a grupos"
                : event.currentPhase.hrefKey === "cuadro"
                  ? "Ir al cuadro"
                  : "Ir a mesas"}
            </Link>
          ) : null}
        </div>
      ) : null}
      {join.confirmed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-felt/40 bg-felt/10 px-4 py-3">
          <p className="text-sm font-semibold">Ya estás inscrito en este torneo.</p>
          <Link href="/participante" className="btn btn-ghost">
            Mis torneos
          </Link>
        </div>
      ) : join.pendingPayment ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="text-sm font-semibold">Solicitud registrada. Realiza el pago para quedar inscrito.</p>
          <div className="mt-3">
            <TournamentPaymentBox entryFee={event.entryFee} payment={event.payment} />
          </div>
        </div>
      ) : join.blockedByCategory ? (
        <div className="rounded-2xl border border-line bg-paper px-4 py-3">
          <p className="text-sm">{categoryMismatchMessage(join.singleCategory)}</p>
        </div>
      ) : join.canSelfJoin ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gold/5 px-4 py-3">
          <p className="text-sm">
            Las inscripciones están abiertas
            {event.entryFee ? ` · ${formatCOP(event.entryFee)}` : ""}
            {event.mix === "SINGLE" && event.singleCategoryName
              ? ` · ${event.singleCategoryName}`
              : " · Mixto"}
            .
          </p>
          <Link href={`/t/${event.slug}/inscribirse`} className="btn btn-primary">
            Inscribirme
          </Link>
        </div>
      ) : null}
      <p className="text-sm text-muted">
        {live === 0
          ? "Sin mesas en juego."
          : `${live} ${live === 1 ? "mesa en juego" : "mesas en juego"}.`}
        {floor.queue.length > 0
          ? ` ${floor.queue.length} ${floor.queue.length === 1 ? "partido" : "partidos"} en cola.`
          : ""}{" "}
        Esta pantalla se actualiza sola.
      </p>
      <PublicFloor tables={floor.tables} queue={floor.queue} equalInnings={event.equalInnings} />
      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-2xl">Del torneo</h2>
          {visible.stats && (
            <Link href={`/t/${event.slug}/stats`} className="text-sm text-gold">
              Ver estadísticas
            </Link>
          )}
        </div>
        {stats.rows.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay partidos cerrados para el promedio.</p>
        ) : (
          <PublicLeaders leaders={stats.leaders} />
        )}
      </section>
    </main>
  );
}
