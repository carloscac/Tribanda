"use client";

import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { Category, Group, GroupMember, Inscription, Match, Player } from "@prisma/client";
import {
  assignInscriptionToGroup,
  closeGroupAsFull,
  generateGroups,
  generateKnockout,
  reopenGroupSetup,
  resolveGroupTie,
} from "@/lib/actions/groups";
import { AddGroupButton } from "@/components/AddGroupButton";
import { GroupDraftPanel } from "@/components/GroupDraftPanel";
import { memberGroupStats } from "@/lib/bracket";
import {
  compareGroupStanding,
  parseGroupTiebreak,
  qualificationFromStanding,
  type GroupTiebreak,
} from "@/lib/group-standing";
import { KnockoutEntryPanel } from "@/components/KnockoutEntryPanel";
import { KnockoutGenerateFields } from "@/components/KnockoutGenerateFields";
import type { KnockoutFillMode, PlayInCandidate } from "@/lib/knockout-entry";
import {
  parseKnockoutLayout,
  suggestBracketSize,
  suggestPlayInBracketSize,
  type KnockoutLayout,
} from "@/lib/knockout-format";
import { ManualResultForm, type ManualResultMatch } from "@/components/ManualResultForm";
import type { AjusteCandidate } from "@/lib/ajuste";
import { ReplacePlayerForm } from "@/components/ReplacePlayerForm";

type PlayerView = Omit<Player, "photoData">;

type Member = GroupMember & {
  inscription: Inscription & { player: PlayerView; category: Category | null };
};

type GroupRow = Group & {
  members: Member[];
  table?: { id: string; number: number } | null;
  matches: (Match & {
    sideA: (Inscription & { player: PlayerView }) | null;
    sideB: (Inscription & { player: PlayerView }) | null;
  })[];
};

const MATCH_LABEL: Record<string, string> = {
  SCHEDULED: "En cola",
  LIVE: "En mesa",
  CLOSED: "Cerrado",
  WALKOVER: "W.O.",
};

const GROUP_STATUS: Record<string, string> = {
  OPEN: "En juego",
  TIE: "Empate — falta desempate",
  RESOLVED: "Clasificación lista",
};

function standings(group: GroupRow, mode: GroupTiebreak) {
  return group.members
    .map((m) => {
      const id = m.inscriptionId;
      const played = group.matches.filter(
        (x) =>
          (x.sideAId === id || x.sideBId === id) &&
          (x.status === "CLOSED" || x.status === "WALKOVER"),
      );
      const stats = memberGroupStats(id, group.matches);
      const locked = group.matches.some(
        (x) =>
          (x.sideAId === id || x.sideBId === id) &&
          (x.status === "LIVE" || x.status === "CLOSED" || x.status === "WALKOVER"),
      );
      return {
        id,
        name: m.inscription.player.name,
        alias: m.inscription.player.alias,
        club: m.inscription.player.club,
        distance: m.inscription.distance,
        category: m.inscription.category?.name,
        categoryId: m.inscription.categoryId,
        paid: m.inscription.paid,
        pj: played.length,
        pg: stats.pg,
        caroms: stats.caroms,
        innings: stats.innings,
        highRun: stats.highRun,
        groupSort: group.sortOrder,
        qualified: m.qualified,
        seed: m.seed,
        locked,
      };
    })
    .sort((a, b) =>
      compareGroupStanding(
        {
          inscriptionId: a.id,
          pg: a.pg,
          caroms: a.caroms,
          innings: a.innings,
          highRun: a.highRun,
          groupSort: a.groupSort,
        },
        {
          inscriptionId: b.id,
          pg: b.pg,
          caroms: b.caroms,
          innings: b.innings,
          highRun: b.highRun,
          groupSort: b.groupSort,
        },
        mode,
      ),
    );
}

function norm(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesQuery(group: GroupRow, q: string) {
  if (!q) return true;
  const hay = [
    group.name,
    ...group.members.flatMap((m) => [
      m.inscription.player.name,
      m.inscription.player.alias,
      m.inscription.player.club,
    ]),
  ]
    .map(norm)
    .join(" ");
  return hay.includes(q);
}

function highlight(text: string, q: string) {
  if (!q || !norm(text).includes(q)) return text;
  return <mark className="rounded bg-gold/35 px-0.5 text-ink">{text}</mark>;
}

function StandingMark({
  qualified,
  seed,
  reencaucheName,
  leftOut,
}: {
  qualified: boolean;
  seed: number | null;
  reencaucheName: string | null;
  leftOut: boolean;
}) {
  if (reencaucheName) {
    return <span className="text-gold">Reencauche · vs {reencaucheName}</span>;
  }
  if (leftOut) return <span className="text-muted">No se reencaucha</span>;
  if (qualified) return <>Clasifica{seed ? ` · ${seed}º` : ""}</>;
  return null;
}

function scoreLine(match: GroupRow["matches"][number]) {
  if (match.status === "WALKOVER") return "W.O.";
  if (match.caromsA == null || match.caromsB == null) return MATCH_LABEL[match.status] ?? match.status;
  const tm =
    match.highRunA != null || match.highRunB != null
      ? ` · TM ${match.highRunA ?? "—"}/${match.highRunB ?? "—"}`
      : "";
  return `${match.caromsA}–${match.caromsB}${match.innings != null ? ` · ${match.innings} ent.` : ""}${tm}`;
}

function toManualMatch(
  match: GroupRow["matches"][number],
  requireInnings: boolean,
): ManualResultMatch | null {
  if (!match.sideAId || !match.sideBId || !match.sideA || !match.sideB) return null;
  return {
    id: match.id,
    sideAId: match.sideAId,
    sideBId: match.sideBId,
    nameA: match.sideA.player.name,
    nameB: match.sideB.player.name,
    distanceA: match.distanceA,
    distanceB: match.distanceB,
    caromsA: match.caromsA,
    caromsB: match.caromsB,
    innings: match.innings,
    highRunA: match.highRunA,
    highRunB: match.highRunB,
    requireInnings,
  };
}

function TieForm({ group, spots, tieIds }: { group: GroupRow; spots: number; tieIds: string[] }) {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      resolveGroupTie(formData),
    null,
  );
  const tied = group.members.filter((m) => tieIds.includes(m.inscriptionId));

  return (
    <form
      action={formAction}
      className="mt-4 rounded-lg border border-gold/50 bg-paper p-4 text-cream shadow-sm"
    >
      <input type="hidden" name="groupId" value={group.id} />
      <p className="text-sm">
        Empate en la línea de corte. Juega penaltis o decide quién pasa, y marca{" "}
        <strong className="text-gold">{spots}</strong> {spots === 1 ? "jugador" : "jugadores"}.
      </p>
      {tied.length === 0 ? (
        <p className="mt-2 text-sm text-danger">
          No se detectaron jugadores empatados. Recarga la página; si sigue igual, revisa los
          resultados del grupo.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {tied.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-line/80 bg-surface/80 px-3 py-2 text-sm font-medium"
            >
              <input
                type="checkbox"
                name="inscriptionId"
                value={m.inscriptionId}
                className="size-4 shrink-0 accent-gold"
              />
              <span>
                {m.inscription.player.name}
                {m.inscription.category?.name ? ` · ${m.inscription.category.name}` : ""}
              </span>
            </label>
          ))}
        </div>
      )}
      <label className="field mt-3 max-w-xs">
        <span>Cómo se resolvió</span>
        <select name="note" defaultValue="penaltis">
          <option value="penaltis">Penaltis</option>
          <option value="decision">Decisión del organizador</option>
        </select>
      </label>
      <button className="btn btn-primary mt-3" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Confirmar quién clasifica"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function GroupsManager({
  tournamentId,
  groups,
  inscriptionCount,
  checkedInCount,
  groupSize,
  qualifyPerGroup,
  groupTiebreak = "CAROMS",
  hasKnockout,
  canRegenerateKnockout,
  categories,
  availablePlayers,
  benchInscriptions,
  requireInnings,
  knockoutLayout,
  knockoutFillMode = "AUTO",
  groupQualified = 0,
  koEligible = 0,
  manualCandidates = [],
  playInMatches = [],
  repescaPool = [],
  qualifiedPool = [],
  secondQualifiedPool = [],
  repescaRoster = [],
  repescaFee = null,
  groupsFinalized = false,
  plannedCapacity = null,
  knockoutPreDraw = false,
  directPassCandidates = [],
  tournamentName = "",
  tables = [],
  ajusteFirsts = [],
  ajusteSeconds = [],
  ajusteReencauchados = [],
  reencaucheSpots = [],
  reencaucheLeftOut = [],
}: {
  tournamentId: string;
  tournamentName?: string;
  tables?: { id: string; number: number }[];
  ajusteFirsts?: AjusteCandidate[];
  ajusteSeconds?: AjusteCandidate[];
  ajusteReencauchados?: AjusteCandidate[];
  reencaucheSpots?: {
    inscriptionId: string;
    name: string;
    groupName: string;
    seed: number;
    opponentName: string | null;
    opponentSeed: number | null;
  }[];
  reencaucheLeftOut?: { inscriptionId: string; name: string; groupName: string }[];
  groups: GroupRow[];
  inscriptionCount: number;
  checkedInCount: number;
  groupSize: number;
  qualifyPerGroup: number;
  groupTiebreak?: string;
  groupsFinalized?: boolean;
  plannedCapacity?: number | null;
  knockoutLayout: KnockoutLayout | string;
  hasKnockout: boolean;
  canRegenerateKnockout: boolean;
  categories: Category[];
  availablePlayers: (PlayerView & { category: Category | null })[];
  benchInscriptions: (Inscription & { player: PlayerView; category: Category | null })[];
  requireInnings: boolean;
  knockoutFillMode?: KnockoutFillMode;
  groupQualified?: number;
  koEligible?: number;
  manualCandidates?: { id: string; name: string; groupName: string }[];
  playInMatches?: (ManualResultMatch & { status: string })[];
  repescaPool?: PlayInCandidate[];
  qualifiedPool?: { id: string; name: string; groupName: string; seed: number | null }[];
  secondQualifiedPool?: { id: string; name: string; groupName: string; seed: number | null }[];
  repescaRoster?: {
    id: string;
    name: string;
    groupName: string;
    repescaOptIn: boolean | null;
    repescaFeePaid: boolean;
    bench?: boolean;
  }[];
  repescaFee?: number | null;
  knockoutPreDraw?: boolean;
  directPassCandidates?: { id: string; name: string; groupName: string; note: string }[];
}) {
  const canSetupGroups = !groupsFinalized || groups.length === 0;
  const groupsLocked = groupsFinalized && groups.length > 0;
  const groupsDraft = canSetupGroups;
  const [reopenState, reopenAction, reopenPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      reopenGroupSetup(formData),
    null,
  );
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      generateGroups(formData),
    null,
  );
  const [koState, koAction, koPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      generateKnockout(formData),
    null,
  );
  const allResolved = groups.length > 0 && groups.every((g) => g.status === "RESOLVED");
  const layout = parseKnockoutLayout(knockoutLayout);
  const qualifiedCount = useMemo(
    () => groups.reduce((n, g) => n + g.members.filter((m) => m.qualified).length, 0),
    [groups],
  );
  const poolSize = useMemo(
    () => groups.reduce((n, g) => n + g.members.length, 0),
    [groups],
  );
  const suggestedBracket = useMemo(() => {
    if (knockoutFillMode === "PLAY_IN") {
      return suggestPlayInBracketSize(
        ajusteFirsts.length + ajusteSeconds.length,
        ajusteReencauchados.length,
      );
    }
    return suggestBracketSize(qualifiedCount, poolSize);
  }, [
    knockoutFillMode,
    ajusteFirsts.length,
    ajusteSeconds.length,
    ajusteReencauchados.length,
    qualifiedCount,
    poolSize,
  ]);
  const [bracketSize, setBracketSize] = useState(suggestedBracket);
  useEffect(() => {
    setBracketSize(suggestedBracket);
  }, [suggestedBracket]);
  const playInOpenMatches = playInMatches.some(
    (match) => match.status === "SCHEDULED" || match.status === "LIVE",
  );
  const playInReady =
    knockoutFillMode !== "PLAY_IN" ||
    koEligible >= bracketSize ||
    (playInMatches.length > 0 && !playInOpenMatches) ||
    (koEligible >= groupQualified && !playInOpenMatches);
  const koPlazasIncomplete =
    !hasKnockout &&
    ((knockoutFillMode === "MANUAL" && koEligible < bracketSize) ||
      (knockoutFillMode === "PLAY_IN" && playInOpenMatches));
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const q = norm(query.trim());
  const replacingMember = groups
    .flatMap((g) => g.members)
    .find((m) => m.inscriptionId === replacingId);

  const visibleGroups = useMemo(
    () => (q.length < 2 ? groups : groups.filter((g) => matchesQuery(g, q))),
    [groups, q],
  );

  const playerHits = useMemo(() => {
    if (q.length < 2) return [];
    return groups.flatMap((g) =>
      g.members
        .filter((m) => {
          const player = m.inscription.player;
          return [player.name, player.alias, player.club].some((v) => norm(v).includes(q));
        })
        .map((m) => ({
          id: m.inscriptionId,
          name: m.inscription.player.name,
          groupId: g.id,
          groupName: g.name,
        })),
    );
  }, [groups, q]);

  useEffect(() => {
    if (q.length < 2) {
      setOpenIds(new Set());
      return;
    }
    setOpenIds(new Set(visibleGroups.map((g) => g.id)));
  }, [q, visibleGroups]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function jumpTo(groupId: string) {
    setOpenIds((prev) => new Set(prev).add(groupId));
    requestAnimationFrame(() => {
      cardRefs.current.get(groupId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const reencaucheById = new Map(reencaucheSpots.map((spot) => [spot.inscriptionId, spot]));
  const leftOutIds = new Set(reencaucheLeftOut.map((row) => row.inscriptionId));

  return (
    <div className="grid min-w-0 gap-6">
      {tournamentName && (
        <div>
          <h1 className="font-serif text-2xl">{tournamentName}</h1>
          <p className="mt-1 text-sm text-muted">
            {groupsDraft
              ? "Armado de grupos — crea la estructura, ubica jugadores y luego genera partidos."
              : "Grupos en juego."}
          </p>
        </div>
      )}

      {groupsLocked && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link href={`/app/torneos/${tournamentId}/mando`} className="btn btn-primary w-full sm:w-auto">
            Ir al mando y mesas
          </Link>
          <Link href={`/app/torneos/${tournamentId}/cuadro`} className="btn btn-ghost w-full sm:w-auto">
            Ver cuadro
          </Link>
        </div>
      )}

      {groupsDraft ? (
        <>
          <GroupDraftPanel
            tournamentId={tournamentId}
            groups={groups}
            benchInscriptions={benchInscriptions}
            groupSize={groupSize}
            plannedCapacity={plannedCapacity}
            inscriptionCount={inscriptionCount}
            checkedInCount={checkedInCount}
            tables={tables}
          />
          {groups.length === 0 && (
            <div className="card border border-line/80">
              <h3 className="font-semibold">Sorteo rápido</h3>
              <p className="mb-3 mt-1 text-sm text-muted">
                Reparte al azar y crea los partidos de una vez (sin editar plazas antes).
              </p>
              <form action={formAction} className="grid max-w-md gap-3">
                <input type="hidden" name="tournamentId" value={tournamentId} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="onlyCheckedIn" defaultChecked={checkedInCount >= 3} />
                  Solo quienes hicieron check-in
                </label>
                <button className="btn btn-ghost border border-line" type="submit" disabled={pending}>
                  {pending ? "Armando…" : "Sortear y generar todo"}
                </button>
                {state && "error" in state && state.error && (
                  <p className="text-sm text-danger">{state.error}</p>
                )}
              </form>
            </div>
          )}
          <p className="text-xs text-muted">
            ¿Cupo previsto o tamaño de grupo?{" "}
            <Link href={`/app/torneos/${tournamentId}/editar`} className="font-semibold text-p1">
              Ajustes del torneo
            </Link>
          </p>
        </>
      ) : groupsLocked ? (
        <>
          <div className="rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted">
            <p>
              Grupos en juego. Nuevos inscritos quedan <strong>sin grupo</strong> hasta que los ubiques
              abajo. Si hace falta otro grupo, agrégalo sin desarmar los que ya están. Si alguien no
              llega, <strong>Sustituir</strong> en su fila.
            </p>
            {!hasKnockout && (
              <div className="mt-3">
                <AddGroupButton tournamentId={tournamentId} />
              </div>
            )}
            {!hasKnockout && (
              <form action={reopenAction} className="mt-3 border-t border-line pt-3">
                <input type="hidden" name="tournamentId" value={tournamentId} />
                <p className="mb-2 text-xs">
                  ¿Quieres probar el armado manual otra vez? Solo si aún no hay resultados de grupos.
                </p>
                <button
                  type="submit"
                  className="btn btn-ghost border border-line text-sm"
                  disabled={reopenPending}
                >
                  {reopenPending ? "Reabriendo…" : "Volver a armar grupos (borrador)"}
                </button>
                {reopenState && "error" in reopenState && reopenState.error && (
                  <p className="mt-2 text-sm text-danger">{reopenState.error}</p>
                )}
              </form>
            )}
          </div>
          {benchInscriptions.length > 0 && (
            <BenchAssignPanel
              tournamentId={tournamentId}
              benchInscriptions={benchInscriptions}
              groups={groups}
            />
          )}
        </>
      ) : null}

      {knockoutPreDraw && hasKnockout && (
        <div className="card border border-felt/40 bg-felt/5">
          <h2 className="font-serif mb-2 text-xl">Cuadro prefijado</h2>
          <p className="text-sm text-muted">
            El árbol de eliminatoria ya está creado (todas las rondas). En{" "}
            <Link href={`/app/torneos/${tournamentId}/cuadro`} className="text-p1">
              Cuadro
            </Link>{" "}
            ves las plazas por grupo y puesto; al cerrar cada grupo se rellenan los nombres.
          </p>
        </div>
      )}

      {allResolved && !knockoutPreDraw && (
        <>
        <div className="card">
          <h2 className="font-serif mb-2 text-xl">Cuadro de eliminación</h2>
          <p className="mb-4 text-sm text-muted">
            {hasKnockout
              ? "Los grupos ya tienen clasificación. Puedes regenerar el cuadro si todavía no se ha jugado ningún cruce."
              : "Arma el cuadro de 32: los 3 mejores primeros vs BYE (pasan a 16) y el resto se cruza en dieciseisavos."}
          </p>
          {poolSize >= 4 && (
            <KnockoutGenerateFields
              knockoutLayout={layout}
              qualifiedCount={qualifiedCount}
              poolSize={poolSize}
              koEligible={koEligible}
              fillMode={knockoutFillMode}
              bracketSize={bracketSize}
              onBracketSizeChange={setBracketSize}
            />
          )}
          {poolSize < 4 && (
            <p className="mb-4 text-sm text-danger">
              Hacen falta al menos 4 jugadores en los grupos para armar un cuadro.
            </p>
          )}
        </div>
        <KnockoutEntryPanel
          tournamentId={tournamentId}
          fillMode={knockoutFillMode}
          groupQualified={groupQualified}
          koEligible={koEligible}
          bracketSize={bracketSize}
          candidates={manualCandidates}
          hasKnockout={hasKnockout}
          playInMatches={playInMatches}
          repescaPool={repescaPool}
          qualifiedPool={qualifiedPool}
          secondQualifiedPool={secondQualifiedPool}
          repescaRoster={repescaRoster}
          repescaFee={repescaFee}
          directPassCandidates={directPassCandidates}
          ajusteFirsts={ajusteFirsts}
          ajusteSeconds={ajusteSeconds}
          ajusteReencauchados={ajusteReencauchados}
          groupsFinalized={groupsFinalized}
        />
        <div className="card">
          <h2 className="font-serif mb-2 text-xl">Sortear cuadro</h2>
          <form action={koAction}>
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <input type="hidden" name="bracketSize" value={bracketSize} />
            {koPlazasIncomplete && (
              <p className="mb-3 text-sm text-muted">
                {knockoutFillMode === "PLAY_IN"
                  ? `Hay partidos de ajuste abiertos. Ciérralos antes de sortear el cuadro de ${bracketSize}.`
                  : `Completa las plazas del cuadro (${koEligible}/${bracketSize}) antes de sortear.`}
              </p>
            )}
            <button
              className="btn btn-primary max-w-xs"
              type="submit"
              disabled={
                koPending ||
                (hasKnockout && !canRegenerateKnockout) ||
                poolSize < 4 ||
                koPlazasIncomplete
              }
            >
              {koPending ? "Armando…" : hasKnockout ? "Regenerar cuadro" : "Generar cuadro"}
            </button>
            {hasKnockout && !canRegenerateKnockout && (
              <p className="mt-2 text-sm text-muted">
                El cuadro ya tiene cruces jugados. No se puede regenerar.
              </p>
            )}
            {koState && "error" in koState && koState.error && (
              <p className="mt-2 text-sm text-danger">{koState.error}</p>
            )}
            {koState && "ok" in koState && koState.ok && (
              <p className="mt-2 text-sm text-felt">Cuadro listo. Ábrelo en Cuadro.</p>
            )}
          </form>
        </div>
        </>
      )}

      {groupsLocked && (
        <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-navy/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en qué grupo quedó un jugador"
              className="w-full rounded-lg border border-line bg-paper py-2.5 pl-10 pr-3 text-sm"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              className="text-p1"
              onClick={() => setOpenIds(new Set(visibleGroups.map((g) => g.id)))}
            >
              Abrir visibles
            </button>
            <span className="text-muted">·</span>
            <button type="button" className="text-p1" onClick={() => setOpenIds(new Set())}>
              Cerrar todos
            </button>
            <span className="text-muted">
              {visibleGroups.length} {visibleGroups.length === 1 ? "grupo" : "grupos"}
            </span>
          </div>
          {q.length >= 2 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {playerHits.length === 0 ? (
                <li className="text-sm text-muted">Nadie con ese nombre en los grupos.</li>
              ) : (
                playerHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-sm"
                      onClick={() => jumpTo(hit.groupId)}
                    >
                      {hit.name} · {hit.groupName}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {knockoutFillMode === "PLAY_IN" && (reencaucheSpots.length > 0 || reencaucheLeftOut.length > 0) && (
        <div className="card">
          <h2 className="font-serif mb-2 text-xl">A dónde van los reencauchados</h2>
          <p className="mb-3 text-sm text-muted">
            Entran al final de la siembra y juegan contra quien los completa en el cuadro. Si no se
            reencauchan, esa plaza queda en BYE para un primero.
          </p>
          {reencaucheSpots.length > 0 ? (
            <ul className="grid gap-1 text-sm">
              {reencaucheSpots.map((spot) => (
                <li key={spot.inscriptionId}>
                  <strong>{spot.seed}</strong> {spot.name}
                  {spot.groupName ? <span className="text-muted"> · {spot.groupName}</span> : null}
                  {" → "}
                  {spot.opponentName ? (
                    <>
                      contra <strong>{spot.opponentSeed}</strong> {spot.opponentName}
                    </>
                  ) : (
                    <span className="text-gold">BYE</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nadie confirmado en el cuadro por reencauche.</p>
          )}
          {reencaucheLeftOut.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              No entran:{" "}
              {reencaucheLeftOut.map((row) => `${row.name}${row.groupName ? ` (${row.groupName})` : ""}`).join(", ")}
              .
            </p>
          ) : null}
        </div>
      )}

      {groupsLocked && (
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleGroups.map((group) => {
          const mode = parseGroupTiebreak(groupTiebreak);
          const table = standings(group, mode);
          const open = openIds.has(group.id);
          const qual = qualificationFromStanding(
            table.map((r) => ({
              inscriptionId: r.id,
              pg: r.pg,
              caroms: r.caroms,
              innings: r.innings,
              highRun: r.highRun,
              groupSort: r.groupSort,
            })),
            qualifyPerGroup,
            mode,
          );
          const done = group.matches.filter(
            (m) => m.status === "CLOSED" || m.status === "WALKOVER",
          ).length;
          return (
            <section
              key={group.id}
              ref={(el) => {
                if (el) cardRefs.current.set(group.id, el);
                else cardRefs.current.delete(group.id);
              }}
              className={`card min-w-0 scroll-mt-28 ${open ? "md:col-span-2 xl:col-span-3" : ""}`}
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                aria-expanded={open}
                onClick={() => toggle(group.id)}
              >
                <div className="min-w-0">
                  <h3 className="font-serif break-words text-2xl">
                    {group.name}
                    {group.table ? (
                      <span className="ml-2 text-base font-sans font-normal text-muted">
                        · Mesa {group.table.number}
                      </span>
                    ) : null}
                  </h3>
                  <p className="mt-1 truncate text-sm text-muted">
                    {table.map((row) => row.name).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {GROUP_STATUS[group.status] ?? group.status} · {done}/{group.matches.length}{" "}
                    partidos
                  </p>
                </div>
                <ChevronDown
                  className={`mt-1 size-5 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
                />
              </button>

              {open && (
                <>
                  <ul className="mt-4 grid gap-3 sm:hidden">
                    {table.map((row) => (
                      <li key={row.id} className="min-w-0 border-t border-line pt-3">
                        <p className="break-words font-medium">
                          {highlight(row.name, q)}
                          {row.category ? ` · ${row.category}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Distancia {row.distance} · PJ {row.pj} · PG {row.pg}
                        </p>
                        <p className="mt-1 text-sm text-felt">
                          <StandingMark
                            qualified={row.qualified}
                            seed={row.seed}
                            reencaucheName={
                              reencaucheById.has(row.id)
                                ? (reencaucheById.get(row.id)?.opponentName ?? "BYE")
                                : null
                            }
                            leftOut={leftOutIds.has(row.id)}
                          />
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-xs text-p1 disabled:text-muted"
                          disabled={row.locked}
                          title={
                            row.locked
                              ? "Ya tiene un partido en mesa o cerrado"
                              : "Cambiar por otra persona sin regenerar grupos"
                          }
                          onClick={() => setReplacingId(row.id)}
                        >
                          Sustituir
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 hidden max-w-full overflow-x-auto sm:block">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-muted">
                          <th className="py-1 pr-3 font-medium">Jugador</th>
                          <th className="py-1 pr-3 font-medium">A</th>
                          <th className="py-1 pr-3 font-medium">PJ</th>
                          <th className="py-1 pr-3 font-medium">PG</th>
                          <th className="py-1 font-medium"></th>
                          <th className="py-1 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.map((row) => (
                          <tr key={row.id} className="border-t border-line">
                            <td className="py-2 pr-3">
                              {highlight(row.name, q)}
                              {row.category ? ` · ${row.category}` : ""}
                            </td>
                            <td className="py-2 pr-3">{row.distance}</td>
                            <td className="py-2 pr-3">{row.pj}</td>
                            <td className="py-2 pr-3">{row.pg}</td>
                            <td className="py-2 text-felt">
                              <StandingMark
                                qualified={row.qualified}
                                seed={row.seed}
                                reencaucheName={
                                  reencaucheById.has(row.id)
                                    ? (reencaucheById.get(row.id)?.opponentName ?? "BYE")
                                    : null
                                }
                                leftOut={leftOutIds.has(row.id)}
                              />
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                className="text-xs text-p1 disabled:text-muted"
                                disabled={row.locked}
                                title={
                                  row.locked
                                    ? "Ya tiene un partido en mesa o cerrado"
                                    : "Cambiar por otra persona sin regenerar grupos"
                                }
                                onClick={() => setReplacingId(row.id)}
                              >
                                Sustituir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {replacingMember &&
                    replacingMember.inscriptionId &&
                    group.members.some((m) => m.inscriptionId === replacingId) && (
                      <div className="mt-4 rounded-lg border border-line p-3">
                        <h4 className="mb-3 font-semibold">
                          Sustituir a {replacingMember.inscription.player.name}
                        </h4>
                        <ReplacePlayerForm
                          key={replacingMember.inscriptionId}
                          inscriptionId={replacingMember.inscriptionId}
                          outgoingName={replacingMember.inscription.player.name}
                          defaultCategoryId={replacingMember.inscription.categoryId ?? ""}
                          defaultDistance={replacingMember.inscription.distance}
                          defaultPaid={replacingMember.inscription.paid}
                          categories={categories}
                          availablePlayers={availablePlayers}
                          benchInscriptions={benchInscriptions}
                          onDone={() => setReplacingId(null)}
                          onCancel={() => setReplacingId(null)}
                        />
                      </div>
                    )}
                  {group.status === "TIE" && qual.spots > 0 && (
                    <TieForm
                      group={group}
                      spots={qual.spots}
                      tieIds={qual.tie.map((t) => t.inscriptionId)}
                    />
                  )}
                  {group.tiebreakNote && (
                    <p className="mt-3 text-sm text-muted">
                      Desempate:{" "}
                      {group.tiebreakNote === "decision"
                        ? "decisión del organizador"
                        : group.tiebreakNote === "sin_mas_inscripciones"
                          ? "cerrado sin más inscripciones (clasifican todos)"
                          : "penaltis"}
                    </p>
                  )}
                  {group.status !== "RESOLVED" &&
                    table.length > 0 &&
                    table.length <= qualifyPerGroup &&
                    done === 0 && (
                      <CloseGroupEarlyForm groupId={group.id} memberCount={table.length} />
                    )}
                  <ul className="mt-4 grid gap-2 text-sm">
                    {group.matches.map((m) => {
                      const manual = toManualMatch(m, requireInnings);
                      const canScore = m.status === "SCHEDULED" || m.status === "LIVE";
                      return (
                        <li key={m.id} className="border-t border-line pt-2">
                          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                            <span className="min-w-0 break-words">
                              {m.sideA?.player.name ?? "?"} ({m.distanceA}) vs{" "}
                              {m.sideB?.player.name ?? "?"} ({m.distanceB})
                            </span>
                            <span className="flex flex-wrap items-center gap-3">
                              <span className="text-muted">{scoreLine(m)}</span>
                              {m.status === "LIVE" && (
                                <Link
                                  href={`/app/torneos/${tournamentId}/mando`}
                                  className="text-xs text-p1"
                                >
                                  Marcador en vivo
                                </Link>
                              )}
                              {canScore && manual && (
                                <button
                                  type="button"
                                  className="text-xs text-p1"
                                  onClick={() =>
                                    setScoringId((id) => (id === m.id ? null : m.id))
                                  }
                                >
                                  {scoringId === m.id ? "Ocultar carga" : "Cargar resultado"}
                                </button>
                              )}
                            </span>
                          </div>
                          {scoringId === m.id && canScore && manual && (
                            <div className="mt-3">
                              <ManualResultForm
                                match={manual}
                                onCancel={() => setScoringId(null)}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          );
        })}
      </div>
      )}

    </div>
  );
}

function BenchAssignPanel({
  tournamentId,
  benchInscriptions,
  groups,
}: {
  tournamentId: string;
  benchInscriptions: (Inscription & { player: PlayerView; category: Category | null })[];
  groups: GroupRow[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      assignInscriptionToGroup(formData),
    null,
  );
  const options = groups.filter((g) => g.members.length < g.maxMembers);

  return (
    <div className="card border border-gold/40">
      <h3 className="font-serif text-lg">Inscritos sin grupo — hay plazas libres</h3>
      <p className="mt-1 text-sm text-muted">
        Elige en qué grupo entra cada uno (solo grupos con cupo). Si el grupo ya
        jugó, se le crean solo los partidos que le faltan.
      </p>
      {state?.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
      <ul className="mt-3 grid gap-3 text-sm">
        {benchInscriptions.map((ins) => (
          <li key={ins.id} className="grid gap-2 border-t border-line pt-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <span className="min-w-0 break-words">{ins.player.name}</span>
            <form action={formAction} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <input type="hidden" name="inscriptionId" value={ins.id} />
              <select
                name="groupId"
                required
                className="w-full min-w-0 rounded border border-line px-2 py-1 text-sm sm:w-auto"
                defaultValue=""
              >
                <option value="" disabled>
                  Grupo con plaza…
                </option>
                {options.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.members.length}/{g.maxMembers})
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary px-2 py-1 text-xs" disabled={pending || options.length === 0}>
                Incluir
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CloseGroupEarlyForm({ groupId, memberCount }: { groupId: string; memberCount: number }) {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      closeGroupAsFull(formData),
    null,
  );
  return (
    <form action={formAction} className="mt-4 rounded-lg border border-line bg-paper p-3">
      <input type="hidden" name="groupId" value={groupId} />
      <p className="text-sm text-muted">
        Solo hay {memberCount} jugadores y ya no llegará nadie más. Puedes cerrar el grupo y que{" "}
        {memberCount === 1 ? "clasifique" : "clasifiquen todos"} sin jugar los partidos pendientes.
      </p>
      <button className="btn btn-ghost mt-2 border border-line text-sm" type="submit" disabled={pending}>
        {pending ? "Cerrando…" : "Cerrar grupo — no llegan más"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
