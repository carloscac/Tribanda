import { playerAverage, type LiveMatchDTO } from "@/lib/dashboard";

function withAverages(data: LiveMatchDTO, innings: number): LiveMatchDTO {
  const n = Math.max(innings, 1);
  return {
    ...data,
    innings,
    sideA: data.sideA
      ? { ...data.sideA, average: playerAverage(data.sideA.caroms, n) }
      : null,
    sideB: data.sideB
      ? { ...data.sideB, average: playerAverage(data.sideB.caroms, n) }
      : null,
  };
}

export function applyAddCarom(data: LiveMatchDTO, side: "A" | "B"): LiveMatchDTO {
  if (!data.sideA || !data.sideB) return data;
  const same = data.currentSide === side;
  let innings = data.innings;
  if (data.currentSide == null) innings = Math.max(innings, 1);
  else if (data.currentSide === "B" && side === "A") innings = Math.max(innings, 1) + 1;

  const serieA = side === "A" ? (same ? data.sideA.serie + 1 : 1) : 0;
  const serieB = side === "B" ? (same ? data.sideB.serie + 1 : 1) : 0;
  const caromsA = data.sideA.caroms + (side === "A" ? 1 : 0);
  const caromsB = data.sideB.caroms + (side === "B" ? 1 : 0);
  const highRunA = Math.max(data.sideA.highRun, serieA);
  const highRunB = Math.max(data.sideB.highRun, serieB);

  return withAverages(
    {
      ...data,
      currentSide: side,
      maxSerie: Math.max(highRunA, highRunB, data.maxSerie),
      sideA: { ...data.sideA, caroms: caromsA, serie: serieA, highRun: highRunA },
      sideB: { ...data.sideB, caroms: caromsB, serie: serieB, highRun: highRunB },
    },
    innings,
  );
}

export function applyPassTurn(data: LiveMatchDTO, side: "A" | "B"): LiveMatchDTO {
  if (!data.sideA || !data.sideB) return data;
  const finishing = data.currentSide ?? side;
  const next = finishing === "A" ? "B" : "A";
  let innings = Math.max(data.innings, 1);
  if (finishing === "B") innings += 1;

  return withAverages(
    {
      ...data,
      currentSide: next,
      sideA: { ...data.sideA, serie: 0 },
      sideB: { ...data.sideB, serie: 0 },
    },
    innings,
  );
}

export function applyUndoCarom(data: LiveMatchDTO): LiveMatchDTO {
  if (!data.sideA || !data.sideB || !data.currentSide) return data;
  const side = data.currentSide;
  const current = side === "A" ? data.sideA : data.sideB;
  if (current.serie > 0) {
    const nextSerie = current.serie - 1;
    const nextCaroms = Math.max(0, current.caroms - 1);
    const patched =
      side === "A"
        ? { ...data, sideA: { ...data.sideA, serie: nextSerie, caroms: nextCaroms } }
        : { ...data, sideB: { ...data.sideB, serie: nextSerie, caroms: nextCaroms } };
    return withAverages(patched, data.innings);
  }
  return data;
}
