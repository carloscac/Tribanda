"use client";

import { useActionState, useMemo, useState } from "react";
import type { Category, Tournament } from "@prisma/client";
import {
  FIRST_ROUND_PAIRING_LABEL,
  KNOCKOUT_FIRST_ROUND_PAIRINGS,
} from "@/lib/bracket-predraw";
import { DRAW_MODE_LABEL, FILL_MODE_LABEL, KNOCKOUT_DRAW_MODES, KNOCKOUT_FILL_MODES } from "@/lib/knockout-entry";
import {
  PARTICIPANT_SCREEN_KEYS,
  PARTICIPANT_SCREEN_LABEL,
  parseParticipantScreens,
} from "@/lib/participant-screens";
import { formatCOP, parseCOP, placeLabel } from "@/lib/labels";
import {
  parsePrizeShareMode,
  prizePoolFromCollected,
  type PrizeShareMode,
} from "@/lib/prize-pool";
import { TournamentImageField } from "@/components/TournamentImageField";
import { compressTournamentImage } from "@/lib/compress-image";
import type { TournamentPayment } from "@/lib/tournament-payment";
import {
  FORM_DEFAULT_GROUP_TIEBREAK,
  GROUP_TIEBREAK_OPTIONS,
  LEGACY_CAROMS_OPTION,
  type GroupTiebreak,
} from "@/lib/group-standing";

type Action = (formData: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
type PrizeRow = { place: number; amount: number; sharePercent: number | null };

const MAX_PRIZE_PLACES = 32;

function clampPrizeCount(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_PRIZE_PLACES, Math.max(0, Math.trunc(n)));
}

function toInputDate(value: Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function TournamentForm({
  action,
  categories,
  tournament,
  configTemplate,
  prizes = [],
  payment,
  listed = true,
  submitLabel,
  groupTiebreak,
}: {
  action: Action;
  categories: Category[];
  /** Edición de un torneo existente */
  tournament?: Omit<Tournament, "imageData">;
  /** Valores iniciales al crear desde otra plantilla (sin nombre ni fecha) */
  configTemplate?: Omit<Tournament, "imageData">;
  prizes?: PrizeRow[];
  payment?: TournamentPayment | null;
  listed?: boolean;
  submitLabel: string;
  groupTiebreak?: GroupTiebreak;
}) {
  const cfg = tournament ?? configTemplate;
  const participantScreens = parseParticipantScreens(cfg?.participantScreens);
  const [imageBusy, setImageBusy] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; ok?: boolean } | null, formData: FormData) => {
      const file = formData.get("image");
      if (file instanceof File && file.size > 0) {
        try {
          formData.set("image", await compressTournamentImage(file));
        } catch {
          return { error: "No se pudo leer la imagen. Prueba JPG o PNG." };
        }
      }
      return (await action(formData)) ?? null;
    },
    null,
  );

  const active = categories.filter((c) => c.active);
  const initialGroupSize = cfg?.groupSize ?? 4;
  const [groupSize, setGroupSize] = useState(initialGroupSize);
  const [qualifyPerGroup, setQualifyPerGroup] = useState(
    String(cfg?.qualifyPerGroup ?? (initialGroupSize === 3 ? 1 : 2)),
  );

  const [prizeCount, setPrizeCount] = useState(clampPrizeCount(prizes.length));
  const [prizeShareMode, setPrizeShareMode] = useState<PrizeShareMode>(
    parsePrizeShareMode(cfg?.prizeShareMode),
  );
  const [prizePoolPercent, setPrizePoolPercent] = useState(
    cfg?.prizePoolPercent != null ? String(cfg.prizePoolPercent) : "",
  );
  const [prizeAmounts, setPrizeAmounts] = useState<string[]>(() =>
    Array.from({ length: MAX_PRIZE_PLACES }, (_, i) => {
      const found = prizes.find((p) => p.place === i + 1);
      return found && found.amount > 0 ? String(found.amount) : "";
    }),
  );
  const [prizeSharePercents, setPrizeSharePercents] = useState<string[]>(() =>
    Array.from({ length: MAX_PRIZE_PLACES }, (_, i) => {
      const found = prizes.find((p) => p.place === i + 1);
      return found?.sharePercent != null ? String(found.sharePercent) : "";
    }),
  );
  const prizeTotal = useMemo(
    () =>
      prizeAmounts
        .slice(0, prizeCount)
        .reduce((sum, value) => sum + (parseCOP(value) || 0), 0),
    [prizeAmounts, prizeCount],
  );
  const shareSum = useMemo(
    () =>
      prizeSharePercents
        .slice(0, prizeCount)
        .reduce((sum, value) => sum + (Number(String(value).trim()) || 0), 0),
    [prizeSharePercents, prizeCount],
  );
  const poolPercentNum = Number(String(prizePoolPercent).trim()) || 100;
  const exampleCollected = (parseCOP(String(cfg?.entryFee ?? "")) || 0) * 10;
  const examplePool = prizePoolFromCollected(exampleCollected, poolPercentNum);

  return (
    <form action={formAction} className="grid gap-6">
      {tournament && <input type="hidden" name="id" value={tournament.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor="name">Nombre del torneo</label>
          <input
            id="name"
            name="name"
            required
            defaultValue={tournament?.name ?? ""}
            placeholder="Copa viernes 3 bandas"
          />
        </div>
        <div className="field">
          <label htmlFor="venue">Sede</label>
          <input id="venue" name="venue" defaultValue={cfg?.venue ?? ""} />
        </div>
        <TournamentImageField
          tournamentId={tournament?.id}
          hasImage={Boolean(tournament?.imageMime)}
          updatedAt={tournament?.updatedAt}
          onBusyChange={setImageBusy}
        />
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="listed" defaultChecked={listed} className="mt-1" />
          <span>
            Visible en el listado público (Torneos e historial). Si lo quitas, el organizador sigue
            viéndolo y quien tenga el enlace puede entrar.
          </span>
        </label>
        <div className="field">
          <label htmlFor="date">Fecha</label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={tournament ? toInputDate(tournament.date) : ""}
          />
        </div>
        <div className="field">
          <label htmlFor="entryFee">Valor de inscripción</label>
          <input
            id="entryFee"
            name="entryFee"
            inputMode="numeric"
            defaultValue={cfg?.entryFee ?? ""}
            placeholder="Ej. 50000"
          />
          <p className="text-xs text-muted">Opcional. Pesos, sin centavos. Déjalo vacío si no cobra.</p>
        </div>
        <div className="field">
          <label htmlFor="paymentMethod">Cómo se paga</label>
          <select id="paymentMethod" name="paymentMethod" defaultValue={payment?.method ?? ""}>
            <option value="">Sin indicar (el organizador confirma a mano)</option>
            <option value="NEQUI">Nequi</option>
            <option value="TRANSFERENCIA">Transferencia bancaria</option>
            <option value="EFECTIVO">Efectivo en la sede</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="paymentAccount">Cuenta o número Nequi</label>
          <input
            id="paymentAccount"
            name="paymentAccount"
            defaultValue={payment?.account ?? ""}
            placeholder="Ej. 3001234567"
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="paymentNote">Indicación de pago</label>
          <input
            id="paymentNote"
            name="paymentNote"
            defaultValue={payment?.note ?? ""}
            placeholder="Titular, banco o referencia"
          />
          <p className="text-xs text-muted">
            El jugador ve estos datos al inscribirse. El organizador marca el pago en Inscritos.
          </p>
        </div>
        <div className="field">
          <label htmlFor="repescaFee">Cobro extra por repesca</label>
          <input
            id="repescaFee"
            name="repescaFee"
            inputMode="numeric"
            defaultValue={cfg?.repescaFee ?? ""}
            placeholder="Opcional"
          />
          <p className="text-xs text-muted">
            Si lo indicas, el organizador marca «Pagó repesca» al inscribir al eliminado en la repesca.
          </p>
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-muted">Categorías</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="mix"
            value="MIXED"
            defaultChecked={(cfg?.mix ?? "MIXED") === "MIXED"}
          />
          Todas las categorías (mixto: cada uno a su distancia)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="mix"
            value="SINGLE"
            defaultChecked={cfg?.mix === "SINGLE"}
          />
          Una sola categoría
        </label>
        <div className="field max-w-xs">
          <label htmlFor="singleCategoryId">Si es una sola, cuál</label>
          <select
            id="singleCategoryId"
            name="singleCategoryId"
            defaultValue={cfg?.singleCategoryId ?? ""}
          >
            <option value="">—</option>
            {active.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (a {c.distance})
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="equalInnings"
            defaultChecked={cfg?.equalInnings ?? true}
          />
          Igualdad de entradas / cierre de entrada
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="requireInnings"
            defaultChecked={cfg?.requireInnings ?? false}
          />
          Entradas obligatorias al registrar el marcador
        </label>
        <p className="text-xs text-muted sm:col-span-2">
          Márcalo si quieres promedio (carambolas / entradas). Si no, el resultado se puede cargar
          solo con carambolas, tacada mayor y ganador.
        </p>
        <div className="field">
          <label htmlFor="maxInnings">Límite de entradas (opcional)</label>
          <input
            id="maxInnings"
            name="maxInnings"
            type="number"
            min={5}
            max={200}
            defaultValue={cfg?.maxInnings ?? ""}
            placeholder="Sin tope"
          />
        </div>
        <div className="field">
          <label htmlFor="tableCount">Mesas</label>
          <input
            id="tableCount"
            name="tableCount"
            type="number"
            min={1}
            max={32}
            defaultValue={cfg?.tableCount ?? 4}
          />
        </div>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-sm font-semibold text-muted sm:col-span-2">Fase de grupos</legend>
        <p className="text-xs text-muted sm:col-span-2">
          Define el tamaño objetivo de cada grupo y cuántos clasifican a eliminatoria. Al sortear
          grupos, el sistema reparte inscritos en grupos de hasta ese tamaño (mínimo 3 por grupo).
        </p>
        <div className="field">
          <label htmlFor="groupSize">Jugadores por grupo (máximo)</label>
          <select
            id="groupSize"
            name="groupSize"
            value={groupSize}
            onChange={(e) => {
              const next = Number(e.target.value);
              setGroupSize(next);
              const q = Number(qualifyPerGroup);
              if (!Number.isFinite(q) || q >= next) {
                setQualifyPerGroup(String(next === 3 ? 1 : 2));
              }
            }}
          >
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} jugadores
              </option>
            ))}
          </select>
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="plannedCapacity">Cupo previsto del torneo (opcional)</label>
          <input
            id="plannedCapacity"
            name="plannedCapacity"
            type="number"
            min={groupSize}
            max={256}
            placeholder="Ej. 24 si esperas llenar 8 grupos de 3"
            defaultValue={cfg?.plannedCapacity ?? ""}
          />
          <p className="text-xs text-muted">
            Si lo indicas, al crear grupos se reservan todas las plazas aunque falten inscritos. Los
            nuevos entran en el grupo que elijas si hay hueco.
          </p>
        </div>
        <div className="field">
          <label htmlFor="qualifyPerGroup">Clasifican por grupo</label>
          <input
            id="qualifyPerGroup"
            name="qualifyPerGroup"
            type="number"
            min={1}
            max={Math.max(1, groupSize - 1)}
            value={qualifyPerGroup}
            onChange={(e) => setQualifyPerGroup(e.target.value)}
            required
          />
          <p className="text-xs text-muted">
            Entre 1 y {groupSize - 1} (menor que el tamaño del grupo). Lo habitual: 1 si el grupo
            es de 3; 2 si es de 4 o más.
          </p>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-muted">
          Criterio de desempate de la fase de grupos
        </legend>
        <p className="text-xs text-muted">
          Los partidos ganados siempre tienen prioridad. Elige cómo desempatar cuando dos o más
          deportistas terminen con la misma cantidad de victorias.
        </p>
        {(groupTiebreak === "CAROMS"
          ? [LEGACY_CAROMS_OPTION, ...GROUP_TIEBREAK_OPTIONS]
          : GROUP_TIEBREAK_OPTIONS
        ).map((option) => {
          const selected = groupTiebreak ?? (tournament ? undefined : FORM_DEFAULT_GROUP_TIEBREAK);
          return (
            <label key={option.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="groupTiebreak"
                value={option.value}
                defaultChecked={selected === option.value}
              />
              <span>
                <strong>{option.title}</strong> — {option.description}
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-muted">Cuadro final (eliminación)</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="knockoutLayout"
            value="COLUMNS"
            defaultChecked={(cfg?.knockoutLayout ?? "COLUMNS") !== "SPLIT"}
          />
          <span>
            <strong>Columnas (estándar)</strong> — rondas en columnas de izquierda a derecha hasta la
            final.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="knockoutLayout"
            value="SPLIT"
            defaultChecked={cfg?.knockoutLayout === "SPLIT"}
          />
          <span>
            <strong>Espejo al centro</strong> — dos mitades del cuadro que convergen en la final
            central. El tamaño (8, 16, 32…) se define al generar la eliminatoria, cuando cierren los
            grupos.
          </span>
        </label>
        <div className="field max-w-md">
          <label htmlFor="knockoutFillMode">Plazas extra al cuadro</label>
          <select
            id="knockoutFillMode"
            name="knockoutFillMode"
            defaultValue={cfg?.knockoutFillMode ?? "PLAY_IN"}
          >
            {KNOCKOUT_FILL_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {FILL_MODE_LABEL[mode]}
              </option>
            ))}
          </select>
        </div>
        <div className="field max-w-md">
          <label htmlFor="knockoutDrawMode">Sorteo del cuadro</label>
          <select
            id="knockoutDrawMode"
            name="knockoutDrawMode"
            defaultValue={cfg?.knockoutDrawMode ?? "FIXED"}
          >
            {KNOCKOUT_DRAW_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {DRAW_MODE_LABEL[mode]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">
            Con ronda de ajuste o manual, el sorteo del cuadro se hace cuando todas las plazas estén llenas.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="knockoutPreDraw"
            defaultChecked={cfg?.knockoutPreDraw ?? false}
          />
          <span>
            <strong>Cuadro prefijado al generar grupos</strong> — se crea el árbol completo al pulsar
            «Generar partidos» (plazas 1.º/2.º por grupo). Requiere plazas extra «Automático» y que{" "}
            <em>grupos × clasificados</em> sea 4, 8, 16, 32 o 64.
          </span>
        </label>
        <div className="field max-w-md">
          <label htmlFor="knockoutFirstRoundPairing">Emparejamiento de 1ª ronda (cuadro prefijado)</label>
          <select
            id="knockoutFirstRoundPairing"
            name="knockoutFirstRoundPairing"
            defaultValue={cfg?.knockoutFirstRoundPairing ?? "CROSS_GROUP_SEED"}
          >
            {KNOCKOUT_FIRST_ROUND_PAIRINGS.map((mode) => (
              <option key={mode} value={mode}>
                {FIRST_ROUND_PAIRING_LABEL[mode]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">
            «Sorteo 1ª ronda» en el desplegable anterior baraja antes de aplicar este criterio.
          </p>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-muted">Pantallas para deportistas</legend>
        <p className="text-xs text-muted">
          En el enlace público del torneo (<code className="text-ink">/t/…</code>). Tú sigues viendo
          todo desde el panel; al copiar un torneo, estas opciones se copian también.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PARTICIPANT_SCREEN_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`participantScreen_${key}`}
                defaultChecked={participantScreens[key]}
              />
              {PARTICIPANT_SCREEN_LABEL[key]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-muted">Premios en dinero</legend>
        <input type="hidden" name="prizeShareMode" value={prizeShareMode} />
        <div className="field max-w-xs">
          <label htmlFor="prizePoolPercent">% de inscripciones para la bolsa de premios</label>
          <input
            id="prizePoolPercent"
            name="prizePoolPercent"
            type="number"
            min={1}
            max={100}
            step={1}
            value={prizePoolPercent}
            onChange={(e) => setPrizePoolPercent(e.target.value)}
            placeholder="Ej. 80"
          />
          <p className="text-xs text-muted">
            Sobre lo recaudado (inscripciones marcadas como pagadas). Vacío = 100 %. Ej.: 1.000.000
            recaudados al 80 % → bolsa {formatCOP(examplePool || 800_000)}.
          </p>
        </div>
        <div className="field max-w-md">
          <span className="mb-2 block text-sm font-medium">Cómo repartes la bolsa</span>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="prizeShareModeUi"
              checked={prizeShareMode === "FIXED"}
              onChange={() => setPrizeShareMode("FIXED")}
            />
            <span>
              <strong>Montos fijos</strong> — defines pesos por puesto (como antes).
            </span>
          </label>
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="prizeShareModeUi"
              checked={prizeShareMode === "PERCENT"}
              onChange={() => setPrizeShareMode("PERCENT")}
            />
            <span>
              <strong>Porcentaje de la bolsa</strong> — ej. 50 % campeón, 20 % subcampeón, 15 % + 15
              % tercero y cuarto (deben sumar 100 %).
            </span>
          </label>
        </div>
        <div className="field max-w-xs">
          <label htmlFor="prizeCount">Cuántos jugadores llevan premio</label>
          <input
            id="prizeCount"
            name="prizeCount"
            type="number"
            min={0}
            max={MAX_PRIZE_PLACES}
            step={1}
            value={prizeCount}
            onChange={(e) => setPrizeCount(clampPrizeCount(Number(e.target.value)))}
          />
          <p className="text-xs text-muted">Entre 0 y {MAX_PRIZE_PLACES}.</p>
        </div>
        {prizeCount > 0 && prizeShareMode === "FIXED" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: prizeCount }, (_, i) => (
                <div className="field" key={i}>
                  <label htmlFor={`prizeAmount-${i}`}>{placeLabel(i + 1)} puesto</label>
                  <input
                    id={`prizeAmount-${i}`}
                    name="prizeAmount"
                    inputMode="numeric"
                    value={prizeAmounts[i] ?? ""}
                    placeholder="Ej. 200000"
                    onChange={(e) => {
                      const next = [...prizeAmounts];
                      next[i] = e.target.value;
                      setPrizeAmounts(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted">
              Bolsa total (fija): {prizeTotal > 0 ? formatCOP(prizeTotal) : "—"}
            </p>
          </>
        )}
        {prizeCount > 0 && prizeShareMode === "PERCENT" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: prizeCount }, (_, i) => (
                <div className="field" key={i}>
                  <label htmlFor={`prizeSharePercent-${i}`}>
                    {placeLabel(i + 1)} puesto (% de la bolsa)
                  </label>
                  <input
                    id={`prizeSharePercent-${i}`}
                    name="prizeSharePercent"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={prizeSharePercents[i] ?? ""}
                    placeholder={i === 0 ? "50" : "20"}
                    onChange={(e) => {
                      const next = [...prizeSharePercents];
                      next[i] = e.target.value;
                      setPrizeSharePercents(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <p
              className={`text-sm ${shareSum === 100 ? "text-felt" : shareSum > 0 ? "text-warning" : "text-muted"}`}
            >
              Suma de porcentajes: {shareSum} % {shareSum === 100 ? "· listo" : "· debe ser 100 %"}
            </p>
            {exampleCollected > 0 && shareSum === 100 && (
              <p className="text-sm text-muted">
                Ejemplo con 10 inscripciones pagadas ({formatCOP(exampleCollected)} recaudados, bolsa{" "}
                {poolPercentNum} % = {formatCOP(examplePool)}):{" "}
                {Array.from({ length: prizeCount }, (_, i) => {
                  const pct = Number(prizeSharePercents[i]) || 0;
                  const amt = Math.floor((examplePool * pct) / 100);
                  return `${placeLabel(i + 1).toLowerCase()} ${formatCOP(amt)}`;
                }).join(" · ")}
              </p>
            )}
          </>
        )}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold text-muted">Otros reconocimientos</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="prizeChampion"
            defaultChecked={cfg?.prizeChampion ?? true}
          />
          Campeón
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="prizeHighRun"
            defaultChecked={cfg?.prizeHighRun ?? true}
          />
          Mayor tacada
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="prizeBestAverage"
            defaultChecked={cfg?.prizeBestAverage ?? true}
          />
          Mejor promedio
        </label>
      </fieldset>

      {state?.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && !state.error && (
        <p className="text-sm text-success" role="status">
          Cambios guardados.
        </p>
      )}

      <button className="btn btn-primary max-w-xs" type="submit" disabled={pending || imageBusy}>
        {pending ? "Guardando…" : imageBusy ? "Preparando imagen…" : submitLabel}
      </button>
    </form>
  );
}
