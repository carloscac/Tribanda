import type { ReactNode } from "react";
import { BracketZoom } from "@/components/bracket/BracketZoom";
import { roundTitle } from "@/lib/bracket";
import { initials } from "@/lib/dashboard";
import { matchInLeftHalf, type KnockoutLayout } from "@/lib/knockout-format";

export type TreePlayer = {
  name: string | null;
  photoUrl: string | null;
  distance: number | null;
};

export type TreeMatch = {
  id: string;
  round: number;
  slot: number;
  status: string;
  closeReason: string | null;
  tableNumber: number | null;
  caromsA: number | null;
  caromsB: number | null;
  winner: "A" | "B" | null;
  playerA: TreePlayer;
  playerB: TreePlayer;
};

function PlayerRow({
  player,
  winner,
  loser,
}: {
  player: TreePlayer;
  winner: boolean;
  loser: boolean;
}) {
  const name = player.name ?? "Por definir";
  return (
    <div
      className={`flex h-8 min-w-0 items-center gap-1.5 overflow-hidden rounded-md border px-1.5 ${
        winner ? "border-gold bg-gold/20" : "border-line bg-[#0c1a2e]"
      } ${loser ? "opacity-70" : ""}`}
      title={name}
    >
      {player.photoUrl ? (
        <img
          src={player.photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-felt text-[10px] font-bold text-white">
          {player.name ? initials(player.name) : "?"}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase">{name}</span>
      {player.distance != null && (
        <span className="shrink-0 rounded bg-gold px-1.5 py-0.5 text-[11px] font-bold text-navy tabular-nums">
          {player.distance}
        </span>
      )}
    </div>
  );
}

function matchPlayers(match: TreeMatch) {
  const bye = match.closeReason === "bye";
  return {
    playerA: bye && !match.playerA.name ? { ...match.playerA, name: "BYE" } : match.playerA,
    playerB: bye && !match.playerB.name ? { ...match.playerB, name: "BYE" } : match.playerB,
  };
}

function MatchCard({
  match,
  extra,
}: {
  match: TreeMatch;
  extra?: ReactNode;
}) {
  const { playerA, playerB } = matchPlayers(match);
  return (
    <div className="min-w-0">
      <div className="grid min-w-0 gap-1">
        <PlayerRow player={playerA} winner={match.winner === "A"} loser={match.winner === "B"} />
        <PlayerRow player={playerB} winner={match.winner === "B"} loser={match.winner === "A"} />
      </div>
      {extra ? <div className="mt-1">{extra}</div> : null}
    </div>
  );
}

function pairMatches(column: TreeMatch[]) {
  const pairs: TreeMatch[][] = [];
  for (let i = 0; i < column.length; i += 2) pairs.push(column.slice(i, i + 2));
  return pairs;
}

function ChampionBlock({ player }: { player: TreePlayer | null }) {
  return (
    <section>
      <h3 className="mb-2 border-b border-gold/40 pb-1 text-center text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
        Campeón
      </h3>
      <div className="py-2">
        {player?.name ? (
          <div className="mx-auto max-w-sm">
            <PlayerRow player={player} winner loser={false} />
            <p className="mt-2 rounded bg-gold py-1 text-center text-[11px] font-bold tracking-wide text-navy uppercase">
              Campeón
            </p>
          </div>
        ) : (
          <p className="text-center text-sm text-muted">Por definir</p>
        )}
      </div>
    </section>
  );
}

function RoundColumn({
  round,
  totalRounds,
  column,
  showConnectors,
  connectorSide,
  renderExtra,
}: {
  round: number;
  totalRounds: number;
  column: TreeMatch[];
  showConnectors: boolean;
  connectorSide: "left" | "right" | "both";
  renderExtra?: (match: TreeMatch) => ReactNode;
}) {
  return (
    <section className="flex w-[100cqw] shrink-0 snap-start flex-col sm:w-72 sm:snap-none">
      <h3 className="mb-2 truncate border-b border-gold/40 pb-1 text-center text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
        {roundTitle(round, totalRounds)}
      </h3>
      <div className="flex flex-1 flex-col">
        {pairMatches(column).map((pair) => (
          <div key={pair[0]!.id} className="flex min-h-0 flex-1">
            {showConnectors && connectorSide !== "right" && (
              <div className="relative w-4 shrink-0">
                <span className="pointer-events-none absolute top-1/2 right-0 h-px w-4 bg-gold/70" />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col justify-around gap-2 py-2">
              {pair.map((match) => (
                <MatchCard key={match.id} match={match} extra={renderExtra?.(match)} />
              ))}
            </div>
            {showConnectors && connectorSide !== "left" && (
              <div className="relative w-4 shrink-0">
                {pair.length === 2 ? (
                  <span className="pointer-events-none absolute top-1/4 bottom-1/4 left-0 w-4 border-y border-r border-gold/70" />
                ) : (
                  <span className="pointer-events-none absolute top-1/2 left-0 h-px w-4 bg-gold/70" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SplitBracketTree({
  matches,
  totalRounds,
  stacked,
  renderExtra,
}: {
  matches: TreeMatch[];
  totalRounds: number;
  stacked: boolean;
  renderExtra?: (match: TreeMatch) => ReactNode;
}) {
  const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);
  const roundsBeforeFinal = rounds.filter((round) => round < totalRounds);
  const finalMatch = matches
    .filter((match) => match.round === totalRounds)
    .sort((a, b) => a.slot - b.slot)[0];
  const champion =
    finalMatch?.winner === "A" ? finalMatch.playerA : finalMatch?.winner === "B" ? finalMatch.playerB : null;

  const wingMatches = (round: number, left: boolean) =>
    matches
      .filter(
        (match) =>
          match.round === round && matchInLeftHalf(match.round, match.slot, totalRounds) === left,
      )
      .sort((a, b) => a.slot - b.slot);

  const wingStack = (left: boolean, title: string) => (
    <div className="grid gap-2">
      <h2 className="text-center text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
        {title}
      </h2>
      {roundsBeforeFinal.map((round) => {
        const column = wingMatches(round, left);
        if (column.length === 0) return null;
        return (
          <section key={round}>
            <h3 className="mb-2 border-b border-gold/40 pb-1 text-center text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
              {roundTitle(round, totalRounds)}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {column.map((match) => (
                <MatchCard key={match.id} match={match} extra={renderExtra?.(match)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );

  if (stacked) {
    return (
      <div className="grid gap-6">
        {wingStack(true, "Mitad izquierda")}
        {wingStack(false, "Mitad derecha")}
        {finalMatch && (
          <section>
            <h3 className="mb-2 border-b border-gold/40 pb-1 text-center text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
              Final
            </h3>
            <MatchCard match={finalMatch} extra={renderExtra?.(finalMatch)} />
          </section>
        )}
        <ChampionBlock player={champion} />
      </div>
    );
  }

  return (
    <BracketZoom>
      <div className="flex w-max items-stretch gap-1">
        {roundsBeforeFinal.map((round, roundIndex) => (
          <RoundColumn
            key={`left-${round}`}
            round={round}
            totalRounds={totalRounds}
            column={wingMatches(round, true)}
            showConnectors={roundIndex < roundsBeforeFinal.length - 1}
            connectorSide="right"
            renderExtra={renderExtra}
          />
        ))}
        <section className="flex w-56 flex-col justify-center px-2">
          <h3 className="mb-2 border-b border-gold/40 pb-1 text-center text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
            Final
          </h3>
          {finalMatch ? (
            <MatchCard match={finalMatch} extra={renderExtra?.(finalMatch)} />
          ) : (
            <p className="text-sm text-muted">Por definir</p>
          )}
          <div className="mt-4">
            <ChampionBlock player={champion} />
          </div>
        </section>
        {[...roundsBeforeFinal].reverse().map((round, roundIndex) => (
          <RoundColumn
            key={`right-${round}`}
            round={round}
            totalRounds={totalRounds}
            column={wingMatches(round, false)}
            showConnectors={roundIndex < roundsBeforeFinal.length - 1}
            connectorSide="left"
            renderExtra={renderExtra}
          />
        ))}
      </div>
    </BracketZoom>
  );
}

export function BracketTree({
  matches,
  totalRounds,
  stacked = false,
  layout = "COLUMNS",
  renderExtra,
}: {
  matches: TreeMatch[];
  totalRounds: number;
  stacked?: boolean;
  layout?: KnockoutLayout;
  renderExtra?: (match: TreeMatch) => ReactNode;
}) {
  const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);
  const finalRound = rounds[rounds.length - 1];
  const finalMatch = matches
    .filter((match) => match.round === finalRound)
    .sort((a, b) => a.slot - b.slot)[0];
  const champion =
    finalMatch?.winner === "A" ? finalMatch.playerA : finalMatch?.winner === "B" ? finalMatch.playerB : null;

  if (layout === "SPLIT") {
    return (
      <SplitBracketTree
        matches={matches}
        totalRounds={totalRounds}
        stacked={stacked}
        renderExtra={renderExtra}
      />
    );
  }

  if (stacked) {
    return (
      <div className="grid gap-2">
        {rounds.map((round) => {
          const column = matches
            .filter((match) => match.round === round)
            .sort((a, b) => a.slot - b.slot);
          return (
            <section key={round}>
              <h3 className="mb-2 border-b border-gold/40 pb-1 text-center text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
                {roundTitle(round, totalRounds)}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {column.map((match) => (
                  <MatchCard key={match.id} match={match} extra={renderExtra?.(match)} />
                ))}
              </div>
              <div className="mx-auto mt-3 h-4 w-px bg-gold/60" aria-hidden />
            </section>
          );
        })}
        <ChampionBlock player={champion} />
      </div>
    );
  }

  return (
    <BracketZoom>
      <div className="flex w-max items-stretch">
        {rounds.map((round, roundIndex) => {
          const column = matches
            .filter((match) => match.round === round)
            .sort((a, b) => a.slot - b.slot);
          const last = roundIndex === rounds.length - 1;
          const pairs = pairMatches(column);
          return (
            <section key={round} className="flex w-[100cqw] shrink-0 snap-start flex-col sm:w-72 sm:snap-none">
              <h3 className="mb-2 truncate border-b border-gold/40 pb-1 text-center text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
                {roundTitle(round, totalRounds)}
              </h3>
              <div className="flex flex-1 flex-col">
                {pairs.map((pair) => (
                  <div key={pair[0]!.id} className="flex min-h-0 flex-1">
                    <div className={`flex min-w-0 flex-1 flex-col ${roundIndex > 0 ? "pl-3" : ""}`}>
                      {pair.map((match) => (
                        <div key={match.id} className="relative flex min-h-0 flex-1 items-center py-1.5">
                          {roundIndex > 0 && (
                            <span className="pointer-events-none absolute top-1/2 left-0 h-px w-3 -translate-x-full bg-gold/70" />
                          )}
                          <div className="w-full min-w-0 pr-1">
                            <MatchCard match={match} extra={renderExtra?.(match)} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {!last && (
                      <div className="relative w-4 shrink-0">
                        {pair.length === 2 ? (
                          <span className="pointer-events-none absolute top-1/4 bottom-1/4 left-0 w-4 border-y border-r border-gold/70" />
                        ) : (
                          <span className="pointer-events-none absolute top-1/2 left-0 h-px w-4 bg-gold/70" />
                        )}
                        <span className="pointer-events-none absolute top-1/2 left-4 h-px w-3 bg-gold/70" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <section className="flex w-[100cqw] shrink-0 snap-start flex-col sm:w-56 sm:snap-none">
          <h3 className="mb-2 border-b border-gold/40 pb-1 text-center text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
            Campeón
          </h3>
          <div className="flex flex-1 items-center py-2">
            {champion?.name ? (
              <div className="w-full">
                <PlayerRow player={champion} winner loser={false} />
                <p className="mt-2 rounded bg-gold py-1 text-center text-[11px] font-bold tracking-wide text-navy uppercase">
                  Campeón
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">Por definir</p>
            )}
          </div>
        </section>
      </div>
    </BracketZoom>
  );
}
