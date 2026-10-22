"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { AddGroupButton } from "@/components/AddGroupButton";
import {
  assignInscriptionToGroup,
  finalizeGroups,
  moveInscriptionToGroup,
  prepareGroupStructure,
  removeInscriptionFromGroup,
  setGroupTable,
  shuffleUnassignedIntoGroups,
} from "@/lib/actions/groups";
import type { Category, Group, GroupMember, Inscription, Player } from "@prisma/client";

type PlayerView = Omit<Player, "photoData">;

type Member = GroupMember & {
  inscription: Inscription & { player: PlayerView; category: Category | null };
};

type GroupRow = Group & {
  members: Member[];
  matches?: { status: string; closeReason: string | null; sideAId: string | null; sideBId: string | null }[];
};

export function GroupDraftPanel({
  tournamentId,
  groups,
  benchInscriptions,
  groupSize,
  plannedCapacity,
  inscriptionCount,
  checkedInCount,
  tables = [],
}: {
  tournamentId: string;
  groups: GroupRow[];
  benchInscriptions: (Inscription & { player: PlayerView; category: Category | null })[];
  groupSize: number;
  plannedCapacity: number | null;
  inscriptionCount: number;
  checkedInCount: number;
  tables?: { id: string; number: number }[];
}) {
  const [prepState, prepAction, prepPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      prepareGroupStructure(formData),
    null,
  );
  const [shuffleState, shuffleAction, shufflePending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      shuffleUnassignedIntoGroups(formData),
    null,
  );
  const router = useRouter();
  const [finState, finAction, finPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) => {
      const result = await finalizeGroups(formData);
      router.refresh();
      return result;
    },
    null,
  );

  const totalSlots = groups.reduce((n, g) => n + g.maxMembers, 0);
  const filled = groups.reduce((n, g) => n + g.members.length, 0);
  const freeSlots = totalSlots - filled;

  if (groups.length === 0) {
    return (
      <div className="card border-2 border-gold/50 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">Paso 1</p>
        <h2 className="font-serif mb-2 text-xl">Crear estructura de grupos</h2>
        <p className="mb-4 text-sm text-muted">
          Puedes crear la estructura con plazas vacías
          {plannedCapacity
            ? ` (cupo previsto ${plannedCapacity} → grupos de hasta ${groupSize})`
            : ""}
          , ubicar cabezas de grupo a mano y sortear solo el resto. Luego generas los partidos.
          También puedes usar el sorteo rápido que hace todo de una vez.
        </p>
        <p className="mb-3 text-sm text-muted">
          {inscriptionCount} inscritos · {checkedInCount} con check-in
        </p>
        <form action={prepAction} className="grid max-w-md gap-3">
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="onlyCheckedIn" defaultChecked={checkedInCount >= 3} />
            Solo quienes hicieron check-in
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="autoFill" defaultChecked />
            Repartir al azar al crear (desmarca para dejar todos en «sin grupo»)
          </label>
          <button className="btn btn-primary" type="submit" disabled={prepPending}>
            {prepPending ? "Creando…" : "Crear estructura de grupos"}
          </button>
          {prepState?.error && <p className="text-sm text-danger">{prepState.error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="card border border-gold/40">
        <h2 className="font-serif mb-2 text-xl">Borrador de grupos</h2>
        <p className="mb-3 text-sm text-muted">
          {filled}/{totalSlots} plazas ocupadas
          {freeSlots > 0 ? ` · ${freeSlots} libres` : ""}
          {benchInscriptions.length > 0
            ? ` · ${benchInscriptions.length} jugador${benchInscriptions.length === 1 ? "" : "es"} sin grupo`
            : ""}
        </p>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-start">
          <AddGroupButton tournamentId={tournamentId} />
          <form action={shuffleAction} className="w-full sm:w-auto">
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <button className="btn btn-ghost w-full border border-line sm:w-auto" type="submit" disabled={shufflePending || benchInscriptions.length === 0}>
              {shufflePending ? "Sorteando…" : "Sortear sin grupo al azar"}
            </button>
          </form>
          <form action={finAction} className="w-full sm:w-auto">
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <button className="btn btn-primary w-full sm:w-auto" type="submit" disabled={finPending}>
              {finPending ? "Generando…" : "Generar partidos y arrancar"}
            </button>
          </form>
        </div>
        {shuffleState?.error && <p className="mt-2 text-sm text-danger">{shuffleState.error}</p>}
        {finState?.error && <p className="mt-2 text-sm text-danger">{finState.error}</p>}
        {finState?.ok && (
          <p className="mt-2 text-sm text-felt">Partidos creados. El torneo ya está en juego.</p>
        )}
      </div>

      {benchInscriptions.length > 0 && (
        <div className="card">
          <h3 className="font-semibold">Sin grupo</h3>
          <ul className="mt-2 grid gap-2 text-sm">
            {benchInscriptions.map((ins) => (
              <li key={ins.id} className="grid gap-2 border-t border-line pt-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <span>{ins.player.name}</span>
                <AssignSelect
                  tournamentId={tournamentId}
                  inscriptionId={ins.id}
                  groups={groups}
                  action={assignInscriptionToGroup}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const free = group.maxMembers - group.members.length;
          return (
            <section key={group.id} className="card min-w-0">
              <h3 className="font-serif text-xl">
                {group.name}{" "}
                <span className="text-sm font-normal text-muted">
                  {group.members.length}/{group.maxMembers}
                </span>
              </h3>
              {tables.length > 0 && (
                <GroupTableSelect groupId={group.id} tableId={group.tableId} tables={tables} />
              )}
              {free > 0 && (
                <p className="mt-1 text-xs text-gold">
                  {free} plaza{free === 1 ? "" : "s"} libre{free === 1 ? "" : "s"}
                </p>
              )}
              <ul className="mt-3 grid gap-2 text-sm">
                {group.members.map((m, idx) => (
                  <li key={m.id} className="grid gap-2 border-t border-line pt-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                    <span className="min-w-0 break-words">
                      {idx === 0 && group.members.length > 1 ? (
                        <span className="mr-1 text-xs text-muted">Cabeza ·</span>
                      ) : null}
                      {m.inscription.player.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {(group.matches ?? []).some(
                        (match) =>
                          (match.sideAId === m.inscriptionId || match.sideBId === m.inscriptionId) &&
                          (match.status === "LIVE" || match.status === "CLOSED" || match.status === "WALKOVER") &&
                          match.closeReason !== "bye",
                      ) ? (
                        <span className="text-xs text-muted">Ya jugó</span>
                      ) : (
                        <>
                          <MoveSelect
                            tournamentId={tournamentId}
                            inscriptionId={m.inscriptionId}
                            currentGroupId={group.id}
                            groups={groups}
                          />
                          <RemoveButton tournamentId={tournamentId} inscriptionId={m.inscriptionId} />
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AssignSelect({
  tournamentId,
  inscriptionId,
  groups,
  action,
}: {
  tournamentId: string;
  inscriptionId: string;
  groups: GroupRow[];
  action: (formData: FormData) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const [, formAction, pending] = useActionState(
    async (_p: { error?: string } | null, formData: FormData) => action(formData),
    null,
  );
  const options = groups.filter((g) => g.members.length < g.maxMembers);

  return (
    <form action={formAction} className="flex w-full min-w-0 items-center gap-1">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="inscriptionId" value={inscriptionId} />
      <select name="groupId" className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-xs sm:max-w-[8rem] sm:flex-none" defaultValue="">
        <option value="" disabled>
          Grupo…
        </option>
        {options.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} ({g.members.length}/{g.maxMembers})
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs text-p1" disabled={pending || options.length === 0}>
        {pending ? "…" : "Poner"}
      </button>
    </form>
  );
}

function MoveSelect({
  tournamentId,
  inscriptionId,
  currentGroupId,
  groups,
}: {
  tournamentId: string;
  inscriptionId: string;
  currentGroupId: string;
  groups: GroupRow[];
}) {
  const [, formAction, pending] = useActionState(
    async (_p: { error?: string } | null, formData: FormData) => moveInscriptionToGroup(formData),
    null,
  );
  const options = groups.filter(
    (g) => g.id !== currentGroupId && g.members.length < g.maxMembers,
  );

  if (options.length === 0) return null;

  return (
    <form action={formAction} className="flex w-full min-w-0 items-center gap-1">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="inscriptionId" value={inscriptionId} />
      <select name="groupId" className="min-w-0 flex-1 rounded border border-line px-1 py-0.5 text-xs sm:max-w-[7rem] sm:flex-none" defaultValue="">
        <option value="" disabled>
          Mover…
        </option>
        {options.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs text-p1" disabled={pending}>
        →
      </button>
    </form>
  );
}

function RemoveButton({
  tournamentId,
  inscriptionId,
}: {
  tournamentId: string;
  inscriptionId: string;
}) {
  const [, formAction, pending] = useActionState(
    async (_p: { error?: string } | null, formData: FormData) =>
      removeInscriptionFromGroup(formData),
    null,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="inscriptionId" value={inscriptionId} />
      <button type="submit" className="text-xs text-muted" disabled={pending}>
        Quitar
      </button>
    </form>
  );
}

function GroupTableSelect({
  groupId,
  tableId,
  tables,
}: {
  groupId: string;
  tableId: string | null;
  tables: { id: string; number: number }[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) => setGroupTable(formData),
    null,
  );
  return (
    <form action={formAction} className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="text-xs text-muted">
        Mesa fija
        <select
          name="tableId"
          defaultValue={tableId ?? ""}
          className="ml-2 w-full min-w-0 max-w-full rounded border border-line px-2 py-1 text-xs sm:w-auto"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          <option value="">Sin mesa fija</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              Mesa {table.number}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="hidden" disabled={pending}>
        Guardar
      </button>
      {state?.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
