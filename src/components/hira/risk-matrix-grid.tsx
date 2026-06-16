"use client";

// Reusable visual risk matrix grid.
//
// Two modes:
//   selection — click a cell to assign a (likelihood, severity) pair.
//   heatmap   — render entry counts per cell, click to filter.
//
// Accessibility:
//   • keyboard navigable (arrow keys, enter to select)
//   • screen reader labels include level + score + action statement
//   • color is augmented with a text label so it is not the only differentiator

import { useState, useEffect, useRef } from "react";

type Likelihood = {
  id: string;
  score: number;
  label: string;
  description: string;
  frequencyGuidance?: string | null;
};

type Severity = {
  id: string;
  score: number;
  label: string;
  description: string;
};

type Cell = {
  likelihoodScore: number;
  severityScore: number;
  riskScore: number;
  riskLevel: string; // LOW | MODERATE | HIGH | CRITICAL
  colorHex: string;
  actionRequired: string;
  responseTimeDays: number;
};

type Props = {
  likelihoods: Likelihood[];
  severities: Severity[];
  cells: Cell[];
  mode: "selection" | "heatmap";
  // selection mode
  selectedLikelihood?: number;
  selectedSeverity?: number;
  onSelect?: (likelihoodScore: number, severityScore: number, cell: Cell) => void;
  // heatmap mode
  cellCounts?: Map<string, number>; // key = `${l}|${s}`
  onCellClick?: (likelihoodScore: number, severityScore: number) => void;
  // shared
  disabled?: boolean;
  caption?: string;
};

export function RiskMatrixGrid({
  likelihoods,
  severities,
  cells,
  mode,
  selectedLikelihood,
  selectedSeverity,
  onSelect,
  cellCounts,
  onCellClick,
  disabled,
  caption
}: Props) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [focused, setFocused] = useState<{ l: number; s: number } | null>(null);

  const cellByKey = new Map(cells.map((c) => [`${c.likelihoodScore}|${c.severityScore}`, c]));

  useEffect(() => {
    if (selectedLikelihood && selectedSeverity) {
      setFocused({ l: selectedLikelihood, s: selectedSeverity });
    }
  }, [selectedLikelihood, selectedSeverity]);

  function handleKey(e: React.KeyboardEvent, l: number, s: number) {
    if (disabled) return;
    const maxL = likelihoods.length;
    const maxS = severities.length;
    let nextL = l;
    let nextS = s;
    switch (e.key) {
      case "ArrowUp":
        nextL = Math.max(1, l - 1);
        break;
      case "ArrowDown":
        nextL = Math.min(maxL, l + 1);
        break;
      case "ArrowLeft":
        nextS = Math.max(1, s - 1);
        break;
      case "ArrowRight":
        nextS = Math.min(maxS, s + 1);
        break;
      case "Enter":
      case " ": {
        const c = cellByKey.get(`${l}|${s}`);
        if (c) {
          if (mode === "selection") onSelect?.(l, s, c);
          else onCellClick?.(l, s);
        }
        e.preventDefault();
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    setFocused({ l: nextL, s: nextS });
    const btn = tableRef.current?.querySelector<HTMLButtonElement>(
      `button[data-cell="${nextL}|${nextS}"]`
    );
    btn?.focus();
  }

  return (
    <div className="rounded-lg border bg-white overflow-x-auto" role="region" aria-label="Risk matrix">
      {caption && (
        <div className="px-4 py-2 border-b text-xs uppercase tracking-wider text-slate-600">{caption}</div>
      )}
      <table ref={tableRef} className="border-collapse w-full">
        <thead>
          <tr>
            <th scope="col" className="p-2 text-[11px] font-medium text-slate-500 text-left">
              ↓ Likelihood / → Severity
            </th>
            {severities.map((s) => (
              <th
                key={s.id}
                scope="col"
                className="p-2 text-xs font-medium text-slate-700 text-center min-w-[100px] border-b border-l"
                title={s.description}
              >
                <div className="text-[10px] text-slate-500">S{s.score}</div>
                <div>{s.label}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {likelihoods.map((l) => (
            <tr key={l.id}>
              <th
                scope="row"
                className="p-2 text-xs font-medium text-slate-700 text-right border-r border-b min-w-[150px]"
                title={l.description}
              >
                <div className="text-[10px] text-slate-500">L{l.score}</div>
                <div>{l.label}</div>
                {l.frequencyGuidance && (
                  <div className="text-[10px] font-normal text-slate-500">{l.frequencyGuidance}</div>
                )}
              </th>
              {severities.map((s) => {
                const c = cellByKey.get(`${l.score}|${s.score}`);
                if (!c) {
                  return (
                    <td key={s.id} className="border-b border-l p-2 text-center text-slate-300">
                      —
                    </td>
                  );
                }
                const isSelected =
                  mode === "selection" &&
                  selectedLikelihood === l.score &&
                  selectedSeverity === s.score;
                const count = cellCounts?.get(`${l.score}|${s.score}`) ?? 0;
                const ariaLabel =
                  mode === "selection"
                    ? `${c.riskLevel} risk, score ${c.riskScore}. Likelihood ${l.label}, Severity ${s.label}. Action: ${c.actionRequired}.`
                    : `${c.riskLevel} risk band. ${count} entries.`;
                return (
                  <td key={s.id} className="border-b border-l p-0">
                    <button
                      type="button"
                      data-cell={`${l.score}|${s.score}`}
                      disabled={disabled}
                      tabIndex={
                        (focused?.l === l.score && focused?.s === s.score) ||
                        (!focused && l.score === 1 && s.score === 1)
                          ? 0
                          : -1
                      }
                      aria-label={ariaLabel}
                      aria-pressed={isSelected || undefined}
                      onClick={() => {
                        if (mode === "selection") onSelect?.(l.score, s.score, c);
                        else onCellClick?.(l.score, s.score);
                      }}
                      onKeyDown={(e) => handleKey(e, l.score, s.score)}
                      onFocus={() => setFocused({ l: l.score, s: s.score })}
                      className={`w-full h-full p-3 text-center transition focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-600 ${
                        isSelected ? "ring-2 ring-offset-1 ring-slate-900" : ""
                      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:brightness-95"}`}
                      style={{ backgroundColor: c.colorHex + "33" }}
                      title={c.actionRequired}
                    >
                      {mode === "heatmap" ? (
                        <>
                          <div className="text-base font-bold text-slate-900">{count || ""}</div>
                          <div className="text-[9px] uppercase tracking-wider" style={{ color: c.colorHex }}>
                            {c.riskLevel}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-slate-900">{c.riskScore}</div>
                          <div
                            className="text-[10px] font-medium uppercase tracking-wider mt-0.5"
                            style={{ color: c.colorHex }}
                          >
                            {c.riskLevel}
                          </div>
                        </>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
