import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareGroupStanding,
  parseGroupTiebreak,
  qualificationFromStanding,
  sortGroupStandings,
  type GroupStandingRow,
} from "./group-standing.ts";

function row(
  id: string,
  pg: number,
  opts: {
    caroms?: number;
    innings?: number;
    highRun?: number;
    groupSort?: number;
  } = {},
): GroupStandingRow {
  return {
    inscriptionId: id,
    pg,
    caroms: opts.caroms ?? 0,
    innings: opts.innings ?? 0,
    highRun: opts.highRun ?? 0,
    groupSort: opts.groupSort ?? 0,
  };
}

/** Ejemplo del requerimiento: todos con 2 victorias y promedios distintos. */
const specExample = [
  row("A", 2, { groupSort: 1, caroms: 85, innings: 100, highRun: 5 }),
  row("B", 2, { groupSort: 2, caroms: 120, innings: 100, highRun: 8 }),
  row("C", 2, { groupSort: 3, caroms: 95, innings: 100, highRun: 6 }),
  row("D", 2, { groupSort: 4, caroms: 150, innings: 100, highRun: 12 }),
  row("E", 2, { groupSort: 5, caroms: 110, innings: 100, highRun: 7 }),
];

function ids(rows: GroupStandingRow[]) {
  return rows.map((r) => r.inscriptionId);
}

describe("criterio de desempate de la fase de grupos", () => {
  it("1. por promedio: primero partidos ganados y después promedio descendente", () => {
    const extra = row("F", 1, { groupSort: 1, caroms: 200, innings: 100 });
    const ordered = sortGroupStandings([...specExample, extra], "AVERAGE");
    assert.deepEqual(ids(ordered), ["D", "B", "E", "C", "A", "F"]);
    assert.ok(ordered[0].caroms / (ordered[0].innings ?? 1) > ordered[1].caroms / (ordered[1].innings ?? 1));
  });

  it("2. por grupo: primero partidos ganados y después número de grupo ascendente", () => {
    const ordered = sortGroupStandings(specExample, "GROUP_ORDER");
    assert.deepEqual(ids(ordered), ["A", "B", "C", "D", "E"]);
  });

  it("3. con la misma cantidad de victorias, el promedio no altera el orden por grupo", () => {
    const ordered = sortGroupStandings(specExample, "GROUP_ORDER");
    assert.deepEqual(ids(ordered), ["A", "B", "C", "D", "E"]);
    assert.ok((ordered[0].caroms / 100) < (ordered[3].caroms / 100));
    assert.equal(
      compareGroupStanding(specExample[0], specExample[3], "GROUP_ORDER") < 0,
      true,
    );
  });

  it("4. más partidos ganados quedan arriba en ambas modalidades", () => {
    const leader = row("L", 3, { groupSort: 8, caroms: 10, innings: 100 });
    const pack = [...specExample, leader];
    assert.equal(sortGroupStandings(pack, "AVERAGE")[0].inscriptionId, "L");
    assert.equal(sortGroupStandings(pack, "GROUP_ORDER")[0].inscriptionId, "L");
    assert.equal(sortGroupStandings(pack, "CAROMS")[0].inscriptionId, "L");
  });

  it("5. ambos criterios funcionan con distintas cantidades de grupos", () => {
    const three = [
      row("G1", 2, { groupSort: 1, caroms: 50, innings: 100 }),
      row("G2", 2, { groupSort: 2, caroms: 90, innings: 100 }),
      row("G3", 2, { groupSort: 3, caroms: 70, innings: 100 }),
    ];
    const eight = Array.from({ length: 8 }, (_, i) =>
      row(`G${i + 1}`, 2, { groupSort: i + 1, caroms: (8 - i) * 20, innings: 100 }),
    );

    assert.deepEqual(ids(sortGroupStandings(three, "GROUP_ORDER")), ["G1", "G2", "G3"]);
    assert.deepEqual(ids(sortGroupStandings(three, "AVERAGE")), ["G2", "G3", "G1"]);
    assert.deepEqual(
      ids(sortGroupStandings(eight, "GROUP_ORDER")),
      ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"],
    );
    assert.deepEqual(
      ids(sortGroupStandings(eight, "AVERAGE")),
      ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"],
    );
  });

  it("6. cada torneo conserva su propia configuración", () => {
    const sameAthletes = specExample;
    const tournamentAverage = { id: "t-avg", mode: parseGroupTiebreak("AVERAGE") };
    const tournamentGroup = { id: "t-grp", mode: parseGroupTiebreak("GROUP_ORDER") };

    assert.deepEqual(ids(sortGroupStandings(sameAthletes, tournamentAverage.mode)), [
      "D",
      "B",
      "E",
      "C",
      "A",
    ]);
    assert.deepEqual(ids(sortGroupStandings(sameAthletes, tournamentGroup.mode)), [
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    assert.notEqual(tournamentAverage.mode, tournamentGroup.mode);
  });

  it("7. torneos existentes sin criterio nuevo mantienen el comportamiento actual (CAROMS)", () => {
    assert.equal(parseGroupTiebreak(undefined), "CAROMS");
    assert.equal(parseGroupTiebreak(null), "CAROMS");
    assert.equal(parseGroupTiebreak(""), "CAROMS");

    const a = row("A", 2, { groupSort: 1, caroms: 10, innings: 20, highRun: 2 });
    const b = row("B", 2, { groupSort: 2, caroms: 8, innings: 4, highRun: 8 });
    const legacy = sortGroupStandings([a, b], parseGroupTiebreak(undefined));
    assert.deepEqual(ids(legacy), ["A", "B"]);
    assert.deepEqual(ids(sortGroupStandings([a, b], "AVERAGE")), ["B", "A"]);

    const qual = qualificationFromStanding([a, b], 1, "CAROMS");
    assert.deepEqual(qual.tie.map((r) => r.inscriptionId).sort(), ["A", "B"]);
    assert.equal(qual.spots, 1);
  });

  it("8. la clasificación se actualiza al cambiar los resultados", () => {
    const before = sortGroupStandings(specExample, "AVERAGE");
    assert.equal(before[0].inscriptionId, "D");

    const afterCorrection = specExample.map((player) =>
      player.inscriptionId === "D" ? { ...player, pg: 1 } : player,
    );
    const after = sortGroupStandings(afterCorrection, "AVERAGE");
    assert.notEqual(after[0].inscriptionId, "D");
    assert.deepEqual(ids(after), ["B", "E", "C", "A", "D"]);

    const afterGroup = sortGroupStandings(afterCorrection, "GROUP_ORDER");
    assert.deepEqual(ids(afterGroup), ["A", "B", "C", "E", "D"]);
  });
});
