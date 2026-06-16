"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

// ── Config type ───────────────────────────────────────────────────────────────
export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
  };
};

// ── Context ───────────────────────────────────────────────────────────────────
const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

export function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within <ChartContainer>");
  return ctx;
}

// ── ChartStyle — injects CSS variables ───────────────────────────────────────
export function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config).filter(([, v]) => v.color);
  if (!entries.length) return null;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart="${id}"] {\n${entries
          .map(([k, v]) => `  --color-${k}: ${v.color};`)
          .join("\n")}\n}`,
      }}
    />
  );
}

// ── ChartContainer ────────────────────────────────────────────────────────────
export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uid = React.useId();
  const chartId = `chart-${id ?? uid.replace(/:/g, "")}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-slate-400 [&_.recharts-cartesian-grid_line]:stroke-slate-100",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

// ── ChartTooltip ──────────────────────────────────────────────────────────────
export const ChartTooltip = RechartsPrimitive.Tooltip;

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  hideLabel = false,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    name?: string | number;
    value?: number | string;
    color?: string;
  }>;
  label?: string;
  className?: string;
  hideLabel?: boolean;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        "grid min-w-[9rem] gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl",
        className,
      )}
    >
      {!hideLabel && label && (
        <p className="mb-0.5 font-semibold text-slate-700">{label}</p>
      )}
      <div className="grid gap-1">
        {payload.map((item, i) => {
          const key = String(item.dataKey ?? item.name ?? "");
          const cfg = config[key];
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: item.color ?? cfg?.color }}
              />
              <span className="text-slate-500">{cfg?.label ?? item.name}</span>
              <span className="ml-auto font-mono font-semibold text-slate-800">
                {item.value?.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ChartLegendContent ────────────────────────────────────────────────────────
export function ChartLegendContent({
  payload,
  className,
}: {
  payload?: Array<{ value?: string; color?: string }>;
  className?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-4 text-[11px]", className)}>
      {payload.map((item, i) => {
        const key = item.value ?? "";
        const cfg = config[key];
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ background: item.color ?? cfg?.color }}
            />
            <span className="text-slate-500">{cfg?.label ?? key}</span>
          </div>
        );
      })}
    </div>
  );
}
