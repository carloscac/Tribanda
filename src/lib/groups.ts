export function partitionGroupSizes(
  n: number,
  maxSize: number,
): { sizes: number[] } | { error: string } {
  const minSize = 3;
  if (maxSize < minSize) {
    return { error: "El tamaño de grupo debe ser al menos 3." };
  }
  if (n < minSize) {
    return { error: "Se necesitan al menos 3 jugadores para armar grupos." };
  }

  let numGroups = Math.ceil(n / maxSize);
  while (numGroups > 1) {
    const base = Math.floor(n / numGroups);
    if (base >= minSize) break;
    numGroups -= 1;
  }
  if (numGroups < 1) return fail(n, maxSize);

  const base = Math.floor(n / numGroups);
  const extra = n % numGroups;
  const sizes = Array.from({ length: numGroups }, (_, i) => base + (i < extra ? 1 : 0));

  if (sizes.some((s) => s < minSize)) return fail(n, maxSize);
  if (sizes.some((s) => s > maxSize)) return fail(n, maxSize);

  return { sizes };
}

function fail(n: number, maxSize: number) {
  return {
    error: `No se pueden repartir ${n} jugadores en grupos de hasta ${maxSize} (mínimo 3 por grupo).`,
  };
}

export function roundRobinPairs<T>(items: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function groupLetter(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return `${groupLetter(Math.floor(index / 26) - 1)}${groupLetter(index % 26)}`;
}

/** Letra del grupo (A, B, C…). */
export function groupLabel(index: number) {
  return groupLetter(index);
}

/** Nombre visible: 1-A, 2-B, 3-C… */
export function groupName(index: number) {
  return `${index + 1}-${groupLetter(index)}`;
}

/** Siguiente nombre libre en formato 1-A, 2-B… */
export function nextGroupName(existingNames: string[]) {
  const used = new Set(existingNames);
  for (let i = 0; i < 100; i += 1) {
    const name = groupName(i);
    if (!used.has(name)) return name;
  }
  return groupName(existingNames.length);
}

/** Grupos previstos si el torneo tiene cupo objetivo (ej. 24 ÷ 3 = 8 grupos). */
export function plannedGroupCount(plannedCapacity: number, groupSize: number) {
  if (!Number.isInteger(plannedCapacity) || plannedCapacity < 3) return null;
  if (!Number.isInteger(groupSize) || groupSize < 3) return null;
  return Math.ceil(plannedCapacity / groupSize);
}

/**
 * Reparte n jugadores en groupCount grupos sin pasar maxSize por grupo (equilibra plazas).
 */
export function balancedGroupFill(
  playerCount: number,
  groupCount: number,
  maxSize: number,
): { sizes: number[] } | { error: string } {
  if (groupCount < 1) return { error: "Hace falta al menos un grupo." };
  if (maxSize < 1) return { error: "Tamaño de grupo no válido." };
  if (playerCount > groupCount * maxSize) {
    return {
      error: `Hay ${playerCount} jugadores pero solo caben ${groupCount * maxSize} en ${groupCount} grupos de hasta ${maxSize}.`,
    };
  }
  const sizes = Array.from({ length: groupCount }, () => 0);
  for (let i = 0; i < playerCount; i += 1) {
    let pick = 0;
    for (let g = 1; g < groupCount; g += 1) {
      if (sizes[g] < sizes[pick]) pick = g;
    }
    if (sizes[pick] >= maxSize) {
      return { error: "No caben más jugadores con la estructura actual." };
    }
    sizes[pick] += 1;
  }
  return { sizes };
}

export function resolveGroupCount(
  playerCount: number,
  groupSize: number,
  plannedCapacity: number | null | undefined,
): { count: number } | { error: string } {
  if (playerCount < 3 && !plannedCapacity) {
    return { error: "Se necesitan al menos 3 jugadores para armar grupos." };
  }
  const planned = plannedCapacity ? plannedGroupCount(plannedCapacity, groupSize) : null;
  if (planned != null && planned >= 1) return { count: planned };
  const partition = partitionGroupSizes(Math.max(playerCount, 3), groupSize);
  if ("error" in partition) return partition;
  return { count: partition.sizes.length };
}
