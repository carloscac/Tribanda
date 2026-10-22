export function MatchScore({ innings, maxSerie }: { innings: number; maxSerie: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gold/30 bg-paper px-4 py-5 text-center">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-gold uppercase">Entrada</p>
      <p className="mt-1 text-5xl font-bold tabular-nums">{innings || 1}</p>
      <div className="my-3 h-px w-10 bg-line" />
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Máx. serie</p>
      <p className="text-2xl font-semibold text-gold tabular-nums">{maxSerie}</p>
    </div>
  );
}
