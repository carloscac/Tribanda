import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MIX_LABEL, STATUS_LABEL, formatCOP, rosterCountLabel, statusBadgeClass } from "@/lib/labels";
import { getSessionUser } from "@/lib/session-user";
import { TournamentCardCover } from "@/components/TournamentCardCover";
import { TournamentVisibilityToggle } from "@/components/TournamentVisibilityToggle";
import { canAccessOrganizerApp, tournamentListWhere } from "@/lib/tournament-access";
import { loadTournamentHiddenMap } from "@/lib/tournament-visibility";

export default async function TournamentsPage() {
  const user = await getSessionUser();
  if (!user || !canAccessOrganizerApp(user.role)) redirect("/entrar");

  const tournaments = await prisma.tournament.findMany({
    where: tournamentListWhere(user.id, user.role),
    orderBy: { createdAt: "desc" },
    omit: { imageData: true },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { inscriptions: true, groups: true } },
      prizes: { orderBy: { place: "asc" } },
    },
  });

  const isAdmin = user.role === "ADMIN";
  const hiddenMap = await loadTournamentHiddenMap(tournaments.map((row) => row.id));

  return (
    <main className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Torneos</h1>
          <p className="page-lead">
            {isAdmin
              ? "Todos los torneos de la plataforma."
              : "Solo los torneos de tu cuenta."}
          </p>
        </div>
        {!isAdmin && (
          <Link href="/app/torneos/nuevo" className="btn btn-primary">
            Nuevo torneo
          </Link>
        )}
      </div>

      {tournaments.length === 0 ? (
        <div className="empty">
          {isAdmin
            ? "Ningún organizador ha creado torneos todavía."
            : "Todavía no hay torneos. Crea el primero: grupos + eliminación, con hándicap por categoría."}
        </div>
      ) : (
        <ul className="grid gap-3">
          {tournaments.map((t) => (
            <li key={t.id} className="card">
              <TournamentCardCover
                tournamentId={t.id}
                hasImage={Boolean(t.imageMime)}
                updatedAt={t.updatedAt}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{t.name}</p>
                  <span className={statusBadgeClass(t.status)}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                  {hiddenMap.get(t.id) ? (
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                      Oculto
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {isAdmin ? `${t.user.name} · ` : ""}
                  {MIX_LABEL[t.mix] ?? t.mix}
                  {t.venue ? ` · ${t.venue}` : ""}
                  {t.date
                    ? ` · ${t.date.toLocaleDateString("es-CO", { dateStyle: "medium" })}`
                    : ""}
                  {` · ${rosterCountLabel(t._count.inscriptions, t.plannedCapacity)}`}
                  {t.entryFee != null ? ` · ${t.entryFee === 0 ? "sin costo" : formatCOP(t.entryFee)}` : ""}
                  {t.prizes.length > 0
                    ? ` · ${t.prizes.length} premios (${formatCOP(t.prizes.reduce((sum, p) => sum + p.amount, 0))})`
                    : ""}
                  {t._count.groups > 0 ? " · grupos listos" : ""}
                </p>
                <div className="mt-3">
                  <TournamentVisibilityToggle tournamentId={t.id} hidden={Boolean(hiddenMap.get(t.id))} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/app/torneos/${t.id}/mando`} className="btn btn-primary">
                  Mando
                </Link>
                <Link href={`/app/torneos/${t.id}`} className="btn btn-ghost">
                  Inscritos
                </Link>
                <Link href={`/app/torneos/${t.id}/grupos`} className="btn btn-ghost">
                  Grupos
                </Link>
                <Link href={`/t/${t.slug}`} className="btn btn-ghost">
                  Público
                </Link>
                {!isAdmin && (
                  <Link
                    href={`/app/torneos/nuevo?desde=${t.id}`}
                    className="btn btn-ghost"
                    title="Nuevo torneo con la misma configuración"
                  >
                    Repetir config.
                  </Link>
                )}
              </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
