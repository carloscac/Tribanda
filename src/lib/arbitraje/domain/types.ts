/** Tipos del arbitraje. Alineados al modelo de `Torneos/web` (Match, MatchVisit). */

export type Side = "A" | "B";

export type MatchStatus = "SCHEDULED" | "LIVE" | "CLOSED" | "WALKOVER";

export type UserRole = "ADMIN" | "ORGANIZER" | "PARTICIPANT";

export type RefereeUser = {
  id: string;
  name: string;
  role: UserRole;
  active: boolean;
};

export type PlayerSide = {
  inscriptionId: string;
  name: string;
  distance: number;
  /** Ruta de la foto. Vacía si el jugador no tiene. */
  photoUrl?: string | null;
};

export type Visit = {
  id: string;
  side: Side;
  inning: number;
  caroms: number;
  endedAt: string | null;
};

/**
 * Límites de tiempo. En la API actual de Tribanda no existen.
 * `null` significa "no configurado": no se inventa un tope reglamentario.
 */
export type TimeConfig = {
  matchLimitMs: number | null;
  timeoutLimitMs: number | null;
};

export type MatchBaseline = {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  organizerId: string;
  phaseLabel: string;
  groupName: string | null;
  roundLabel: string | null;
  tableNumber: number | null;
  status: MatchStatus;
  paused: boolean;
  closeReason: string | null;
  winnerSide: Side | null;
  equalInnings: boolean;
  maxInnings: number | null;
  requireInnings: boolean;
  sideA: PlayerSide;
  sideB: PlayerSide;
  visits: Visit[];
  liveStartedAt: string | null;
  /** Momento en que la tablet recibió este estado. Sirve de ancla si el partido ya venía en pausa. */
  pulledAt: string;
  revision: string;
  timeConfig: TimeConfig;
};

export type EventType =
  | "CAROM"
  | "BREAK"
  | "INNING"
  | "UNDO"
  | "UNDO_SERVER"
  | "PAUSE"
  | "RESUME"
  | "TIMEOUT_START"
  | "TIMEOUT_END"
  | "FINISH";

export type RefereeEvent = {
  id: string;
  matchId: string;
  refereeId: string;
  deviceId: string;
  createdAt: string;
  type: EventType;
  side?: Side;
  targetEventId?: string;
  winnerSide?: Side;
  closeReason?: string;
};

export type SyncMark = "pending" | "synced" | "error";

export type StoredEvent = RefereeEvent & {
  sync: SyncMark;
  attempts: number;
  lastError?: string;
};

export type LocalMatch = {
  baseline: MatchBaseline;
  events: StoredEvent[];
  ackedRevision: string;
  conflict: null | {
    message: string;
    serverRevision: string;
    at: string;
  };
};

export type ScoreSide = {
  caroms: number;
  serie: number;
  highRun: number;
  average: number;
};

export type ClockView = {
  elapsedMs: number;
  /** Tiempo en mesa de cada jugador, medido con las marcas de sus visitas. */
  elapsedMsA: number;
  elapsedMsB: number;
  /** Cuenta atrás de 40 segundos del tiro. El que no tiene el turno queda en 40. */
  shotLimitMs: number;
  shotRemainingMsA: number;
  shotRemainingMsB: number;
  remainingMs: number | null;
  running: boolean;
  paused: boolean;
  inTimeout: boolean;
  /** La pausa ya existía en el servidor y no hay marca de cuándo empezó. */
  pauseAnchorApproximate: boolean;
  timeoutCount: number;
  matchLimitMs: number | null;
  timeoutLimitMs: number | null;
};

export type MatchView = {
  matchId: string;
  tournamentName: string;
  phaseLabel: string;
  groupName: string | null;
  roundLabel: string | null;
  tableNumber: number | null;
  status: MatchStatus;
  paused: boolean;
  closeReason: string | null;
  winnerSide: Side | null;
  winnerName: string | null;
  currentSide: Side | null;
  innings: number;
  maxInnings: number | null;
  lastEntry: { side: Side; caroms: number } | null;
  sideA: PlayerSide & ScoreSide;
  sideB: PlayerSide & ScoreSide;
  clock: ClockView;
  history: HistoryItem[];
  pendingCount: number;
  conflict: LocalMatch["conflict"];
  revision: string;
};

export type HistoryItem = {
  id: string;
  label: string;
  at: string;
  undone: boolean;
  pending: boolean;
};
