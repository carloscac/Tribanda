import Link from "next/link";
import { ShareResultButton } from "@/components/ShareResultButton";
import { ParticipantNewAlert } from "@/components/participant/ParticipantNewAlert";

export const dynamic = "force-dynamic";
import { ParticipantNotifications } from "@/components/participant/ParticipantNotifications";
import {
  PARTICIPANT_SCREEN_KEYS,
  PARTICIPANT_SCREEN_LABEL,
  parseParticipantScreens,
  publicPathForScreen,
} from "@/lib/participant-screens";
import { rosterCountLabel, STATUS_LABEL } from "@/lib/labels";
import { careerAverage, formatCareerAverage } from "@/lib/player-label";
import { placeName } from "@/lib/standing";
import { shareCopiesForInscriptions, shareCopy } from "@/lib/share-card";
import { loadParticipantHome } from "@/lib/participant-data";
import { TournamentCardCover } from "@/components/TournamentCardCover";
import { requireParticipant } from "@/lib/session-user";
import { loadTournamentPhases, phasePublicHref } from "@/lib/tournament-phase";

export default async function ParticipantHomePage() {
  const user = await requireParticipant();
  const { inscriptions, closedInscriptions, player, notifications, unreadCount, liveMatches } =
    await loadParticipantHome(user.id);

  const byTournament = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      status: string;
      groupsFinalized: boolean;
      imageMime: string | null;
      updatedAt: Date;
      paid: boolean;
      registered: number;
      plannedCapacity: number | null;
      rows: typeof inscriptions;
    }
  >();
  for (const row of inscriptions) {
    const key = row.tournamentId;
    const bucket = byTournament.get(key) ?? {
      id: row.tournament.id,
      name: row.tournament.name,
      slug: row.tournament.slug,
      status: row.tournament.status,
      groupsFinalized: row.tournament.groupsFinalized,
      imageMime: row.tournament.imageMime,
      updatedAt: row.tournament.updatedAt,
      paid: row.paid,
      registered: row.tournament._count.inscriptions,
      plannedCapacity: row.tournament.plannedCapacity,
      rows: [],
    };
    bucket.paid = bucket.paid || row.paid;
    bucket.rows.push(row);
    byTournament.set(key, bucket);
  }
  const shareByInscription = await shareCopiesForInscriptions(
    inscriptions.map((row) => ({
      inscriptionId: row.id,
      tournamentId: row.tournamentId,
      playerId: row.player.id,
      playerName: row.player.name,
      tournamentName: row.tournament.name,
      slug: row.tournament.slug,
    })),
  );
  const phases = await loadTournamentPhases(
    [...byTournament.values()].map((row) => ({
      id: row.id,
      status: row.status,
      groupsFinalized: row.groupsFinalized,
    })),
  );

  return (
    <main className="grid gap-8">
      <ParticipantNewAlert unreadCount={unreadCount} />
      <section>
        <h1 className="text-2xl font-semibold">Mis torneos</h1>
        <p className="mt-1 text-sm text-muted">
          Torneos donde estás inscrito y siguen abiertos (inscripción o en curso).
        </p>
        {byTournament.size === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No tienes un torneo activo vinculado a tu cédula. Pide al organizador que te inscriba con tu
            número de documento.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {[...byTournament.values()].map((t) => {
              const screens = parseParticipantScreens(t.rows[0]?.tournament.participantScreens);
              const links = PARTICIPANT_SCREEN_KEYS.filter((k) => screens[k]);
              const phase = phases.get(t.id);
              const mainHref = phase
                ? phasePublicHref(t.slug, phase, screens)
                : links.length > 0
                  ? publicPathForScreen(t.slug, links[0])
                  : `/t/${t.slug}`;
              return (
                <li key={t.slug} className="card">
                  <TournamentCardCover
                    tournamentId={t.id}
                    hasImage={Boolean(t.imageMime)}
                    updatedAt={t.updatedAt}
                  />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{t.name}</h2>
                      <p className="text-sm text-muted">
                        {STATUS_LABEL[t.status] ?? t.status}
                        {phase ? ` · ${phase.label}` : ""}
                        {` · ${rosterCountLabel(t.registered, t.plannedCapacity)}`}
                        {t.paid ? "" : " · Pendiente de pago"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shareByInscription[t.rows[0].id] ? (
                        <ShareResultButton
                          title={`${t.rows[0].player.name} · ${shareByInscription[t.rows[0].id].headline}`}
                          text={shareByInscription[t.rows[0].id].firstPerson}
                          path={shareByInscription[t.rows[0].id].path}
                          className="btn btn-ghost px-3 py-1.5 text-sm"
                        />
                      ) : null}
                      <Link href={mainHref} className="btn btn-primary text-sm">
                        Abrir torneo
                      </Link>
                    </div>
                  </div>
                  {links.length > 1 && (
                    <nav className="mt-3 flex flex-wrap gap-2">
                      {links.map((key) => (
                        <Link
                          key={key}
                          href={publicPathForScreen(t.slug, key)}
                          className={`rounded-full px-2.5 py-0.5 text-xs ${
                            phase?.hrefKey === key
                              ? "border border-felt bg-felt/15 font-semibold text-felt"
                              : "border border-line"
                          }`}
                        >
                          {PARTICIPANT_SCREEN_LABEL[key]}
                          {phase?.hrefKey === key ? " · ahora" : ""}
                        </Link>
                      ))}
                    </nav>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(closedInscriptions.length > 0 || (player?.tournamentRecords.length ?? 0) > 0) && (
        <section>
          <h2 className="text-lg font-semibold">Historial</h2>
          <p className="mt-1 text-sm text-muted">Torneos ya finalizados, títulos y promedio.</p>
          {player ? (
            <p className="mt-2 text-sm">
              Campeonatos: <strong>{player.tournamentRecords.filter((row) => row.isChampion).length}</strong>
              {" · "}
              Promedio general:{" "}
              <strong>
                {formatCareerAverage(
                  careerAverage(
                    player.tournamentRecords.reduce((sum, row) => sum + row.caroms, 0),
                    player.tournamentRecords.reduce((sum, row) => sum + row.innings, 0),
                  ),
                )}
              </strong>
              {player.handicap != null ? ` · Handicap ${player.handicap}` : ""}
            </p>
          ) : null}
          <ul className="mt-3 grid gap-2">
            {(player?.tournamentRecords.length
              ? player.tournamentRecords
              : closedInscriptions.map((row) => ({
                  id: row.id,
                  playerId: row.player.id,
                  tournamentSlug: row.tournament.slug,
                  tournamentName: row.tournament.name,
                  tournamentDate: row.tournament.date,
                  venue: row.tournament.venue,
                  isChampion: false,
                  place: null as number | null,
                  average: null as number | null,
                  played: 0,
                  won: 0,
                }))
            ).map((row) => {
              const playerId = row.playerId;
              const slug = row.tournamentSlug;
              const historyShare =
                playerId && slug
                  ? shareCopy({
                      playerName: player?.name ?? "Yo",
                      tournamentName: row.tournamentName,
                      playerId,
                      slug,
                      place: row.isChampion ? 1 : row.place,
                      kind: row.isChampion ? "champion" : row.place ? "placed" : "eliminated",
                    })
                  : null;
              return (
              <li key={row.id} className="rounded-xl border border-line bg-paper px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{row.tournamentName}</div>
                    <div className="text-muted">
                      {row.tournamentDate ? row.tournamentDate.toLocaleDateString("es-CO") : "Sin fecha"}
                      {row.venue ? ` · ${row.venue}` : ""}
                      {" · "}
                      {row.isChampion
                        ? "Campeón"
                        : row.place
                          ? placeName(row.place)
                          : "Finalizado"}
                      {row.average != null ? ` · Prom. ${formatCareerAverage(row.average)}` : ""}
                    </div>
                  </div>
                  {historyShare ? (
                    <ShareResultButton
                      title={`${player?.name ?? "Mi puesto"} · ${historyShare.headline}`}
                      text={historyShare.firstPerson}
                      path={historyShare.path}
                      className="btn btn-ghost px-3 py-1.5 text-sm"
                    />
                  ) : null}
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      )}

      {liveMatches.length > 0 && (
        <section className="card border-live/40">
          <h2 className="text-lg font-semibold text-live">En mesa ahora</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {liveMatches.map((m) => (
              <li key={m.id}>
                <strong>{m.tournament.name}</strong> · Mesa {m.table?.number ?? "—"} ·{" "}
                {m.sideA?.player.name} vs {m.sideB?.player.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">
          Avisos {unreadCount > 0 ? `(${unreadCount} nuevos)` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Toca <strong className="text-ink">Activar avisos con sonido</strong> (barra inferior) una vez
          en tu celular. Luego el aviso aparece arriba y suena cuando te llaman a mesa.
        </p>
        <div className="mt-4">
          <ParticipantNotifications rows={notifications} />
        </div>
      </section>
    </main>
  );
}
