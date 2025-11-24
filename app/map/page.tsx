"use client";

import React from "react";
import {
  GRID_ROWS,
  GRID_COLS,
  microTiles,
} from "@/config/season4/season4_40x40_micro_tiles";

type Tile = (typeof microTiles)[number];

const MACRO_ROWS = 13;
const MACRO_COLS = 13;

// Macro layout: 3 rows/cols each, middle band is 4
const macroRowHeights = [3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3];
const macroColWidths = [3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3];

// Prefix sums for mapping micro → macro
const rowStarts: number[] = [];
const colStarts: number[] = [];

{
  let acc = 0;
  for (let i = 0; i < MACRO_ROWS; i += 1) {
    rowStarts.push(acc);
    acc += macroRowHeights[i];
  }
}
{
  let acc = 0;
  for (let i = 0; i < MACRO_COLS; i += 1) {
    colStarts.push(acc);
    acc += macroColWidths[i];
  }
}

// Sanity checks
if (rowStarts[MACRO_ROWS - 1] + macroRowHeights[MACRO_ROWS - 1] !== GRID_ROWS) {
  console.warn("Row mapping does not sum to GRID_ROWS = 40");
}
if (colStarts[MACRO_COLS - 1] + macroColWidths[MACRO_COLS - 1] !== GRID_COLS) {
  console.warn("Col mapping does not sum to GRID_COLS = 40");
}

function getMacroRowRange(mr: number) {
  const start = rowStarts[mr];
  const height = macroRowHeights[mr];
  return { start, end: start + height - 1 };
}

function getMacroColRange(mc: number) {
  const start = colStarts[mc];
  const width = macroColWidths[mc];
  return { start, end: start + width - 1 };
}

function getMacroTiles(mr: number, mc: number): Tile[] {
  const { start: rStart, end: rEnd } = getMacroRowRange(mr);
  const { start: cStart, end: cEnd } = getMacroColRange(mc);
  return microTiles.filter(
    (t) =>
      t.row >= rStart &&
      t.row <= rEnd &&
      t.col >= cStart &&
      t.col <= cEnd
  );
}

// Main macro label: TC7 wins, otherwise majority non-overlay code
function getMacroLabel(tiles: Tile[]): string {
  if (tiles.some((t) => t.code === "TC7")) {
    return "TC7";
  }

  const ignoreCodes = new Set(["TP1", "TP2", "TP3", "TP4", "HM", "DT"]);
  const counts: Record<string, number> = {};

  for (const t of tiles) {
    const code = t.code;
    if (!code || ignoreCodes.has(code)) continue;
    counts[code] = (counts[code] ?? 0) + 1;
  }

  let best = "";
  let bestCount = 0;
  for (const [code, n] of Object.entries(counts)) {
    if (n > bestCount) {
      best = code;
      bestCount = n;
    }
  }

  return best;
}

// ---------- Overlay clustering: TP1–4 / HM / DT ----------

type Overlay = { label: string };

const overlayCodes = new Set(["TP1", "TP2", "TP3", "TP4", "HM", "DT"]);

// map micro cell -> macro coords
function macroForCell(row: number, col: number): { mr: number; mc: number } {
  let mr = 0;
  for (let i = 0; i < MACRO_ROWS; i += 1) {
    const { start, end } = getMacroRowRange(i);
    if (row >= start && row <= end) {
      mr = i;
      break;
    }
  }
  let mc = 0;
  for (let j = 0; j < MACRO_COLS; j += 1) {
    const { start, end } = getMacroColRange(j);
    if (col >= start && col <= end) {
      mc = j;
      break;
    }
  }
  return { mr, mc };
}

// group all overlay micro cells by code
const codeCells: Record<string, { row: number; col: number }[]> = {};
for (const t of microTiles) {
  if (!overlayCodes.has(t.code)) continue;
  if (!codeCells[t.code]) codeCells[t.code] = [];
  codeCells[t.code].push({ row: t.row, col: t.col });
}

// 4-way connectivity clusters for each overlay code
function clustersForCode(code: string) {
  const all = codeCells[code] ?? [];
  const remaining = new Set(all.map((c) => `${c.row},${c.col}`));
  const clusters: { row: number; col: number }[][] = [];

  while (remaining.size > 0) {
    const startKey = remaining.values().next().value as string;
    remaining.delete(startKey);
    const [sr, sc] = startKey.split(",").map(Number);

    const stack: [number, number][] = [[sr, sc]];
    const comp: { row: number; col: number }[] = [{ row: sr, col: sc }];

    while (stack.length > 0) {
      const [r, c] = stack.pop() as [number, number];
      const neighbors: [number, number][] = [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ];
      for (const [nr, nc] of neighbors) {
        const key = `${nr},${nc}`;
        if (remaining.has(key)) {
          remaining.delete(key);
          stack.push([nr, nc]);
          comp.push({ row: nr, col: nc });
        }
      }
    }

    clusters.push(comp);
  }

  return clusters;
}

// For each cluster, choose a macro cell anchor and store overlaysByMacroCell
const overlaysByMacroCell: Record<string, Overlay[]> = {};

for (const code of overlayCodes) {
  const clusters = clustersForCode(code);
  for (const comp of clusters) {
    // count which macro cell each cluster cell sits in
    const counts: Record<string, { mr: number; mc: number; n: number }> = {};
    for (const cell of comp) {
      const { mr, mc } = macroForCell(cell.row, cell.col);
      const key = `${mr},${mc}`;
      if (!counts[key]) {
        counts[key] = { mr, mc, n: 0 };
      }
      counts[key].n += 1;
    }

    // pick macro cell with highest count; tie-break upward then left
    let best = Object.values(counts)[0];
    for (const entry of Object.values(counts)) {
      if (
        entry.n > best.n ||
        (entry.n === best.n &&
          (entry.mr < best.mr ||
            (entry.mr === best.mr && entry.mc < best.mc)))
      ) {
        best = entry;
      }
    }

    const macroKey = `${best.mr}-${best.mc}`;
    if (!overlaysByMacroCell[macroKey]) overlaysByMacroCell[macroKey] = [];
    overlaysByMacroCell[macroKey].push({ label: code });
  }
}

// ---------- Manual TP4 correction from our previous chat ----------
//
// Move TP4 from macro row 5, col 9 (1-based) to macro row 4, col 9.
// Zero-based macro indices: (4, 8) -> (3, 8).
{
  const fromKey = `${4}-${8}`;
  const toKey = `${3}-${8}`;
  const overlays = overlaysByMacroCell[fromKey];
  if (overlays && overlays.length > 0) {
    const stay = overlays.filter((o) => o.label !== "TP4");
    const move = overlays.filter((o) => o.label === "TP4");
    if (move.length > 0) {
      overlaysByMacroCell[fromKey] = stay;
      if (!overlaysByMacroCell[toKey]) overlaysByMacroCell[toKey] = [];
      overlaysByMacroCell[toKey].push(...move);
    }
  }
}

// ---------- Component: simple 13×13 “table” with overlays in cells ----------

export default function Season4PlanningMap() {
  return (
    <div className="min-h-screen bg-neutral-900 text-black p-4">
      <h1 className="text-xl font-bold mb-4 text-white">
        Season IV · Planning map (13 × 13)
      </h1>

      <p className="text-sm mb-4 max-w-3xl text-neutral-200">
        Each square is a macro tile with its main type (C1, DS1–6, HST2, FS3,
        BF4, ST5, E6, TC7). TP1–TP4 and HM / DT are shown as small boxes inside
        their macro tiles (cluster based), with the TP4 manual correction
        applied.
      </p>

      <div className="inline-block">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${MACRO_COLS}, 56px)`,
            gridTemplateRows: `repeat(${MACRO_ROWS}, 56px)`,
            gap: 2,
          }}
        >
          {Array.from({ length: MACRO_ROWS }).map((_, mr) =>
            Array.from({ length: MACRO_COLS }).map((_, mc) => {
              const macroTiles = getMacroTiles(mr, mc);
              const label = getMacroLabel(macroTiles);
              const key = `${mr}-${mc}`;
              const overlays = overlaysByMacroCell[key] ?? [];

              return (
                <div
                  key={key}
                  className="relative border border-neutral-400 bg-white flex items-center justify-center"
                >
                  {/* main tile label */}
                  <span className="text-xs font-semibold select-none">
                    {label}
                  </span>

                  {/* overlays in this macro cell, drawn in the top-left corner */}
                  {overlays.map((ov, index) => (
                    <div
                      key={`${key}-${ov.label}-${index}`}
                      className="absolute border border-black bg-white text-[10px] px-2 py-[2px] rounded-sm select-none"
                      style={{
                        top: 4 + index * 14,
                        left: 4,
                      }}
                    >
                      {ov.label}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
