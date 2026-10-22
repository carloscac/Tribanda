export type PlayerStanding =
  | "waiting"
  | "grouped"
  | "tie"
  | "live"
  | "qualified"
  | "eliminated"
  | "placed"
  | "champion";

export const STANDING_LABEL: Record<PlayerStanding, string> = {
  waiting: "En espera",
  grouped: "En grupo",
  tie: "En desempate",
  live: "En juego",
  qualified: "Clasificado",
  eliminated: "Eliminado",
  placed: "Premiado",
  champion: "Campeón",
};

const PLACE_WORD = [
  "",
  "Campeón",
  "Subcampeón",
  "Tercer",
  "Cuarto",
  "Quinto",
  "Sexto",
  "Séptimo",
  "Octavo",
  "Noveno",
  "Décimo",
];

export function placeName(place: number) {
  if (place === 1 || place === 2) return PLACE_WORD[place];
  if (place >= 3 && place <= 10) return `${PLACE_WORD[place]} puesto`;
  return `${place}º puesto`;
}

export function standingBadgeClass(standing: PlayerStanding) {
  if (standing === "champion") return "badge badge-draft";
  if (standing === "placed") return "badge badge-info";
  if (standing === "qualified") return "badge badge-info";
  if (standing === "live") return "badge badge-live";
  if (standing === "eliminated") return "badge badge-muted";
  if (standing === "tie") return "badge badge-draft";
  return "badge badge-muted";
}

export type StandingInfo = {
  kind: PlayerStanding;
  label: string;
};

type GroupFact = {
  settled: boolean;
  tie: boolean;
  qualified: boolean;
};

type MatchFact = {
  phase: string;
  status: string;
  closeReason: string | null;
  sideAId: string | null;
  sideBId: string | null;
  winnerId: string | null;
  nextMatchId: string | null;
  round: number;
  caromsA?: number | null;
  caromsB?: number | null;
  distanceA?: number;
  distanceB?: number;
  highRunA?: number | null;
  highRunB?: number | null;
};

function finished(status: string) {
  return status === "CLOSED" || status === "WALKOVER";
}

function loserPerformance(match: MatchFact, loserId: string) {
  const sideA = match.sideAId === loserId;
  const caroms = sideA ? match.caromsA : match.caromsB;
  const distance = sideA ? match.distanceA : match.distanceB;
  const highRun = sideA ? match.highRunA : match.highRunB;
  const scored = caroms ?? -1;
  const pct = distance && scored >= 0 ? scored / distance : scored;
  return { pct, caroms: scored, highRun: highRun ?? -1 };
}

export function knockoutPrizePlaces(matches: MatchFact[], prizeSlots: number) {
  const places = new Map<string, number>();
  if (prizeSlots < 1) return places;

  const ko = matches.filter((match) => match.phase === "KO" && match.closeReason !== "bye");
  if (ko.length === 0) return places;
  const finalRound = ko.reduce((max, match) => Math.max(max, match.round), 0);
  const done = ko.filter(
    (match) => finished(match.status) && match.winnerId && match.sideAId && match.sideBId,
  );

  const final = done.find((match) => match.round === finalRound);
  if (final?.winnerId && final.sideAId && final.sideBId) {
    places.set(final.winnerId, 1);
    const loserId = final.winnerId === final.sideAId ? final.sideBId : final.sideAId;
    if (prizeSlots >= 2) places.set(loserId, 2);
  }

  const rounds = [...new Set(done.map((match) => match.round))]
    .filter((round) => round < finalRound)
    .sort((a, b) => b - a);

  for (const round of rounds) {
    const fromEnd = finalRound - round;
    let nextPlace = 2 ** fromEnd + 1;
    if (nextPlace > prizeSlots) continue;
    const losers = done
      .filter((match) => match.round === round && match.winnerId && match.sideAId && match.sideBId)
      .map((match) => {
        const id = match.winnerId === match.sideAId ? match.sideBId! : match.sideAId!;
        return { id, ...loserPerformance(match, id) };
      })
      .sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct;
        if (b.caroms !== a.caroms) return b.caroms - a.caroms;
        if (b.highRun !== a.highRun) return b.highRun - a.highRun;
        return a.id.localeCompare(b.id);
      });
    for (const loser of losers) {
      if (nextPlace > prizeSlots) break;
      if (!places.has(loser.id)) places.set(loser.id, nextPlace);
      nextPlace += 1;
    }
  }

  return places;
}

export function standingsForInscriptions(
  inscriptionIds: string[],
  groups: { inscriptionId: string; group: GroupFact }[],
  matches: MatchFact[],
  prizeSlots = 1,
) {
  const byId = new Map<string, GroupFact[]>();
  for (const row of groups) {
    const list = byId.get(row.inscriptionId) ?? [];
    list.push(row.group);
    byId.set(row.inscriptionId, list);
  }

  const ko = matches.filter((match) => match.phase === "KO" && match.closeReason !== "bye");
  const places = knockoutPrizePlaces(matches, prizeSlots);
  const result = new Map<string, StandingInfo>();

  for (const id of inscriptionIds) {
    const facts = byId.get(id) ?? [];
    const inGroup = facts.length > 0;
    const qualified = facts.some((fact) => fact.qualified);
    const settledOut =
      facts.some((fact) => fact.settled && !fact.qualified) && !qualified;
    const inTie = facts.some((fact) => fact.tie && !fact.qualified) && !qualified;
    const live = matches.some(
      (match) =>
        match.status === "LIVE" &&
        match.closeReason !== "bye" &&
        (match.sideAId === id || match.sideBId === id),
    );
    const lostKnockout = ko.some(
      (match) =>
        finished(match.status) &&
        match.winnerId &&
        match.winnerId !== id &&
        (match.sideAId === id || match.sideBId === id),
    );
    const place = places.get(id);
    let kind: PlayerStanding = "waiting";
    if (place === 1) kind = "champion";
    else if (place) kind = "placed";
    else if (live) kind = "live";
    else if (lostKnockout || settledOut) kind = "eliminated";
    else if (qualified) kind = "qualified";
    else if (inTie) kind = "tie";
    else if (inGroup) kind = "grouped";
    result.set(id, { kind, label: place ? placeName(place) : STANDING_LABEL[kind] });
  }

  return result;
}
