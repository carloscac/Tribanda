import { BracketTree, type TreeMatch } from "@/components/bracket/BracketTree";
import { parseKnockoutLayout, type KnockoutLayout } from "@/lib/knockout-format";
import type { PublicMatchView } from "@/lib/public-board";

function toTree(match: PublicMatchView): TreeMatch {
  return {
    id: match.id,
    round: match.round,
    slot: match.bracketSlot ?? 0,
    status: match.status,
    closeReason: match.closeReason,
    tableNumber: match.tableNumber,
    caromsA: match.caromsA,
    caromsB: match.caromsB,
    winner: match.winnerSide,
    playerA: { name: match.nameA, photoUrl: match.photoA, distance: match.nameA ? match.distanceA : null },
    playerB: { name: match.nameB, photoUrl: match.photoB, distance: match.nameB ? match.distanceB : null },
  };
}

export function PublicBracket({
  matches,
  totalRounds,
  stacked = false,
  knockoutLayout,
}: {
  matches: PublicMatchView[];
  totalRounds: number;
  stacked?: boolean;
  knockoutLayout?: KnockoutLayout | string | null;
}) {
  const layout = parseKnockoutLayout(knockoutLayout ?? undefined);
  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted">
        El cuadro aparece cuando cierran los grupos y el organizador lo arma.
      </p>
    );
  }

  return (
    <BracketTree
      matches={matches.map(toTree)}
      totalRounds={totalRounds}
      stacked={stacked}
      layout={layout}
    />
  );
}
