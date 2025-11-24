"use client";

import React, { useMemo, useState } from "react";
import { season4Template } from "@/config/season4/season4_40x40_template";

// ----- Types -----

type MacroLabel = string;

interface MacroCell {
  mr: number;
  mc: number;
  label: MacroLabel;
}

interface DsRegion {
  id: string;
  label: "DS1";
  cells: { mr: number; mc: number }[];
  anchor: { mr: number; mc: number };
}

type OverlayType = "TP1" | "TP2" | "TP3" | "TP4" | "HM" | "DT";

interface OverlayBox {
  id: string;
  type: OverlayType;
  anchorMr: number;
  anchorMc: number; // macro intersection anchor (top-left of the 2x2 block)
}

// ----- Micro → Macro mapping (40×40 → 13×13) -----

const MACRO_ROWS = 13;
const MACRO_COLS = 13;

// row / col sizes in micro tiles
const macroRowHeights = [3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3];
const macroColWidths = [3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3];

const GRID_ROWS = 40;
const GRID_COLS = 40;

function buildStarts(sizes: number[]): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (let i = 0; i < sizes.length; i += 1) {
    starts.push(acc);
    acc += sizes[i];
  }
  return starts;
}

const rowStarts = buildStarts(macroRowHeights);
const colStarts = buildStarts(macroColWidths);

function getMacroMicroRange(
  idx: number,
  starts: number[],
  sizes: number[]
): { start: number; end: number } {
  const start = starts[idx];
  const size = sizes[idx];
  return { start, end: start + size - 1 };
}

function microToMacroIndex(
  pos: number,
  starts: number[],
  sizes: number[]
): number {
  for (let i = 0; i < starts.length; i += 1) {
    const s = starts[i];
    const e = s + sizes[i] - 1;
    if (pos >= s && pos <= e) return i;
  }
  return -1;
}

// Decide macro label from micro codes in that block
function deriveMacroLabel(mr: number, mc: number): string {
  const { start: rStart, end: rEnd } = getMacroMicroRange(
    mr,
    rowStarts,
    macroRowHeights
  );
  const { start: cStart, end: cEnd } = getMacroMicroRange(
    mc,
    colStarts,
    macroColWidths
  );

  const counts: Record<string, number> = {};
  const ignore = new Set<OverlayType>(["TP1", "TP2", "TP3", "TP4", "HM", "DT"]);

  for (let r = rStart; r <= rEnd; r += 1) {
    for (let c = cStart; c <= cEnd; c += 1) {
      const code = season4Template[r][c];
      if (!code || ignore.has(code as OverlayType)) continue;
      counts[code] = (counts[code] ?? 0) + 1;
    }
  }

  // If TC7 present anywhere, that wins
  if (Object.keys(counts).includes("TC7")) return "TC7";

  let best = "";
  let bestCount = 0;
  for (const [code, n] of Object.entries(counts)) {
    if (n > bestCount) {
      best = code;
      bestCount = n;
    }
  }
  return best || "";
}

function buildMacroGrid(): MacroCell[][] {
  const grid: MacroCell[][] = [];

  for (let mr = 0; mr < MACRO_ROWS; mr += 1) {
    const row: MacroCell[] = [];
    for (let mc = 0; mc < MACRO_COLS; mc += 1) {
      row.push({
        mr,
        mc,
        label: deriveMacroLabel(mr, mc),
      });
    }
    grid.push(row);
  }

  return grid;
}

// ----- DS1 region detection on macro grid -----

function findDs1Regions(macro: MacroCell[][]): DsRegion[] {
  const rows = macro.length;
  const cols = rows > 0 ? macro[0].length : 0;
  const visited: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  );

  const inBounds = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols;

  const regions: DsRegion[] = [];
  let regionCounter = 0;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (visited[r][c]) continue;
      if (macro[r][c].label !== "DS1") continue;

      const cells: { mr: number; mc: number }[] = [];
      const queue: { mr: number; mc: number }[] = [{ mr: r, mc: c }];
      visited[r][c] = true;

      while (queue.length > 0) {
        const { mr, mc } = queue.shift()!;
        cells.push({ mr, mc });

        const neighbors = [
          { mr: mr - 1, mc },
          { mr: mr + 1, mc },
          { mr, mc: mc - 1 },
          { mr, mc: mc + 1 },
        ];
        for (const nb of neighbors) {
          if (!inBounds(nb.mr, nb.mc)) continue;
          if (visited[nb.mr][nb.mc]) continue;
          if (macro[nb.mr][nb.mc].label !== "DS1") continue;
          visited[nb.mr][nb.mc] = true;
          queue.push(nb);
        }
      }

      // Anchor: smallest row, then smallest col
      let anchor = cells[0];
      for (const cell of cells) {
        if (
          cell.mr < anchor.mr ||
          (cell.mr === anchor.mr && cell.mc < anchor.mc)
        ) {
          anchor = cell;
        }
      }

      regions.push({
        id: `ds1-${regionCounter++}`,
        label: "DS1",
        cells,
        anchor,
      });
    }
  }

  return regions;
}

// ----- Overlay detection on micro grid (centered on macro intersections) -----

const OVERLAY_SET = new Set<OverlayType>([
  "TP1",
  "TP2",
  "TP3",
  "TP4",
  "HM",
  "DT",
]);

function findOverlays(): OverlayBox[] {
  const visited: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    Array(GRID_COLS).fill(false)
  );

  const inBounds = (r: number, c: number) =>
    r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS;

  const overlays: OverlayBox[] = [];
  let overlayCounter = 0;

  for (let r = 0; r < GRID_ROWS; r += 1) {
    for (let c = 0; c < GRID_COLS; c += 1) {
      if (visited[r][c]) continue;
      const code = season4Template[r][c] as OverlayType;
      if (!OVERLAY_SET.has(code)) continue;

      // Flood-fill this overlay cluster
      const queue: { r: number; c: number }[] = [{ r, c }];
      visited[r][c] = true;
      const cells: { r: number; c: number }[] = [];

      while (queue.length > 0) {
        const { r: cr, c: cc } = queue.shift()!;
        cells.push({ r: cr, c: cc });

        const neighbors = [
          { r: cr - 1, c: cc },
          { r: cr + 1, c: cc },
          { r: cr, c: cc - 1 },
          { r: cr, c: cc + 1 },
        ];
        for (const nb of neighbors) {
          if (!inBounds(nb.r, nb.c)) continue;
          if (visited[nb.r][nb.c]) continue;
          if (season4Template[nb.r][nb.c] !== code) continue;
          visited[nb.r][nb.c] = true;
          queue.push(nb);
        }
      }

      // Compute center of the cluster in micro coordinates
      let sumR = 0;
      let sumC = 0;
      for (const cell of cells) {
        sumR += cell.r;
        sumC += cell.c;
      }
      const avgR = sumR / cells.length;
      const avgC = sumC / cells.length;

      // Map the cluster center to macro cell indices
      const centerMicroR = Math.round(avgR);
      const centerMicroC = Math.round(avgC);

      const macroR = microToMacroIndex(
        centerMicroR,
        rowStarts,
        macroRowHeights
      );
      const macroC = microToMacroIndex(
        centerMicroC,
        colStarts,
        macroColWidths
      );

      if (macroR < 0 || macroC < 0) continue;

      overlays.push({
        id: `ov-${overlayCounter++}`,
        type: code,
        anchorMr: macroR,
        anchorMc: macroC,
      });
    }
  }

  return overlays;
}

// ----- Component -----

type RegionStatus = "none" | "ally" | "enemy";

const CELL_SIZE = 60; // px

export default function Season4MacroRegionsWithOverlaysPage() {
  const macroGrid = useMemo(() => buildMacroGrid(), []);
  const dsRegions = useMemo(() => findDs1Regions(macroGrid), [macroGrid]);
  const overlays = useMemo(() => findOverlays(), []);

  // status per DS1 region
  const [regionStatus, setRegionStatus] = useState<Record<string, RegionStatus>>(
    () => {
      const initial: Record<string, RegionStatus> = {};
      for (const reg of dsRegions) initial[reg.id] = "none";
      return initial;
    }
  );

  // quick lookup: which DS1 region (if any) a macro cell belongs to
  const regionByCellKey = useMemo(() => {
    const m = new Map<string, DsRegion>();
    for (const reg of dsRegions) {
      for (const cell of reg.cells) {
        m.set(`${cell.mr}-${cell.mc}`, reg);
      }
    }
    return m;
  }, [dsRegions]);

  const onAnchorChange = (regionId: string, value: RegionStatus) => {
    setRegionStatus((prev) => ({ ...prev, [regionId]: value }));
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4">
      <h1 className="text-xl font-bold mb-4">
        Season IV · 13×13 macro map (DS1 regions + centered TP/HM/DT overlays)
      </h1>

      <div
        className="relative inline-block bg-white"
        style={{
          width: MACRO_COLS * CELL_SIZE,
          height: MACRO_ROWS * CELL_SIZE,
        }}
      >
        {/* Macro grid */}
        <div
          className="absolute top-0 left-0 inline-grid text-black"
          style={{
            gridTemplateColumns: `repeat(${MACRO_COLS}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${MACRO_ROWS}, ${CELL_SIZE}px)`,
            width: "100%",
            height: "100%",
          }}
        >
          {macroGrid.map((row, mr) =>
            row.map((cell, mc) => {
              const key = `${mr}-${mc}`;
              const region = regionByCellKey.get(key);
              const isDs1 = cell.label === "DS1";
              const isAnchor =
                region &&
                region.anchor.mr === mr &&
                region.anchor.mc === mc;

              const status: RegionStatus | undefined = region
                ? regionStatus[region.id]
                : undefined;

              let bg = "white";
              if (status === "ally") bg = "#d1fae5"; // green-ish
              if (status === "enemy") bg = "#fee2e2"; // red-ish

              return (
                <div
                  key={key}
                  className="relative flex items-center justify-center border border-black"
                  style={{ backgroundColor: region ? bg : "white" }}
                >
                  {isAnchor && isDs1 ? (
                    <div className="flex flex-col items-center text-[10px] gap-1">
                      <span className="font-semibold">{cell.label}</span>
                      <select
                        className="border border-gray-400 text-[10px] px-1 py-0.5"
                        value={regionStatus[region!.id]}
                        onChange={(e) =>
                          onAnchorChange(
                            region!.id,
                            e.target.value as RegionStatus
                          )
                        }
                      >
                        <option value="none">None</option>
                        <option value="ally">Ally</option>
                        <option value="enemy">Enemy</option>
                      </select>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold select-none">
                      {cell.label}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Overlays: TP1–TP4, HM, DT, centered at macro intersections */}
        {overlays.map((ov) => {
          // center of intersection between (mr,mc) and (mr+1,mc+1)
          const centerY = (ov.anchorMr + 1) * CELL_SIZE;
          const centerX = (ov.anchorMc + 1) * CELL_SIZE;

          const boxSize = CELL_SIZE * 1.4;
          const topPx = centerY - boxSize / 2;
          const leftPx = centerX - boxSize / 2;

          return (
            <div
              key={ov.id}
              className="absolute flex items-center justify-center border-2 border-black bg-white text-xs font-semibold select-none"
              style={{
                top: topPx,
                left: leftPx,
                width: boxSize,
                height: boxSize,
              }}
            >
              {ov.type}
            </div>
          );
        })}
      </div>
    </div>
  );
}
