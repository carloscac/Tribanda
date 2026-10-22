export type PrizeShareMode = "FIXED" | "PERCENT";

export type PrizeDefinition = {
  place: number;
  amount: number;
  sharePercent: number | null;
};

export type ResolvedPrize = PrizeDefinition;

export function inscriptionRevenue(
  inscriptions: { paid: boolean }[],
  entryFee: number | null,
) {
  const paidCount = inscriptions.filter((i) => i.paid).length;
  const total = inscriptions.length;
  if (entryFee == null) {
    return { paidCount, total, collected: 0, potentialIfAllPaid: 0 };
  }
  return {
    paidCount,
    total,
    collected: paidCount * entryFee,
    potentialIfAllPaid: total * entryFee,
  };
}

export function prizePoolFromCollected(collected: number, prizePoolPercent: number | null) {
  const pct = prizePoolPercent ?? 100;
  if (collected <= 0 || pct <= 0) return 0;
  return Math.floor((collected * pct) / 100);
}

export function parsePrizeShareMode(raw: string | null | undefined): PrizeShareMode {
  return raw === "PERCENT" ? "PERCENT" : "FIXED";
}

export function resolveTournamentPrizes(
  tournament: {
    entryFee: number | null;
    prizePoolPercent: number | null;
    prizeShareMode: string;
  },
  prizes: PrizeDefinition[],
  inscriptions: { paid: boolean }[],
) {
  const revenue = inscriptionRevenue(inscriptions, tournament.entryFee);
  const poolPercent = tournament.prizePoolPercent ?? 100;
  const prizePool = prizePoolFromCollected(revenue.collected, tournament.prizePoolPercent);
  const mode = parsePrizeShareMode(tournament.prizeShareMode);

  const resolved: ResolvedPrize[] = prizes.map((p) => {
    if (mode === "PERCENT" && p.sharePercent != null) {
      return {
        ...p,
        amount: Math.floor((prizePool * p.sharePercent) / 100),
      };
    }
    return { ...p };
  });

  const shareSum =
    mode === "PERCENT"
      ? prizes.reduce((n, p) => n + (p.sharePercent ?? 0), 0)
      : null;
  const prizeTotal = resolved.reduce((sum, p) => sum + p.amount, 0);

  return {
    mode,
    poolPercent,
    prizePool,
    prizeTotal,
    shareSum,
    revenue,
    prizes: resolved,
  };
}
