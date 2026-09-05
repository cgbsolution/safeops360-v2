"use client";

// Consolidated facilities map — renders all factories on a real, border-correct
// map of India (react-simple-maps + a self-hosted Survey-of-India-aligned
// TopoJSON at /public/geo/india-states.json), coloured by compliance band.
// The geography AND the pins are projected by the SAME d3 projection, so pins
// always land in the right place (no manual alignment).
//
// Geography file: /public/geo/india-states.json — a Datameet-derived, official-
// borders India states TopoJSON (J&K + Arunachal shown as part of India).
// Replace it with your own Survey-of-India boundary if compliance requires.

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { BAND_HEX, complianceBand, fmtNum, type FactoryProfile } from "./lib";
import { Card } from "@/components/ui/card";

const GEO_URL = "/geo/india-states.json";

// Projection tuned to fit mainland India. If India sits too high/low or too
// zoomed, nudge `scale` (±100) and `center` ([lng, lat]). Sanity check: Surat
// (72.83, 21.17) should land in Gujarat — a pin in the ocean means a lat/long
// pair is reversed in the data, not a projection problem.
const PROJECTION_CONFIG = { scale: 1100, center: [82.8, 22.6] as [number, number] };

const GEO_FILL = "#eef1f6";
const GEO_STROKE = "#c9d2e0";
const GEO_FILL_HOVER = "#e4e9f2";

type Hover = { f: FactoryProfile; x: number; y: number };

export function IndiaMap({
  factories,
  height = 620,
  onSelectFactory,
}: {
  factories: FactoryProfile[];
  height?: number;
  onSelectFactory?: (f: FactoryProfile) => void;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<Hover | null>(null);

  const select = onSelectFactory ?? ((f: FactoryProfile) => router.push(`/facilities/${f.id}`));

  const { plottable, unplottable } = useMemo(() => {
    const plottable = factories.filter((f) => Number.isFinite(f.latitude) && Number.isFinite(f.longitude));
    return { plottable, unplottable: factories.length - plottable.length };
  }, [factories]);

  const onMove = useCallback(
    (f: FactoryProfile) => (evt: React.MouseEvent<SVGCircleElement>) => {
      const svg = evt.currentTarget.ownerSVGElement;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      setHover({ f, x: evt.clientX - rect.left, y: evt.clientY - rect.top });
    },
    []
  );

  return (
    <Card className="relative rounded-xl border border-slate-200 bg-white p-2 shadow-none" style={{ width: "100%" }}>
      {/* legend */}
      <div className="absolute left-4 top-3 z-10 flex flex-wrap gap-3 text-[11px] text-slate-500">
        {(["green", "amber", "red", "none"] as const).map((b) => (
          <span key={b} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BAND_HEX[b] }} />
            {b === "green" ? "≥ 85%" : b === "amber" ? "75–84%" : b === "red" ? "< 75%" : "no score"}
          </span>
        ))}
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={PROJECTION_CONFIG}
        width={800}
        height={height}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: { fill: GEO_FILL, stroke: GEO_STROKE, strokeWidth: 0.5, outline: "none" },
                  hover: { fill: GEO_FILL_HOVER, stroke: GEO_STROKE, strokeWidth: 0.5, outline: "none" },
                  pressed: { fill: GEO_FILL_HOVER, outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {plottable.map((f) => {
          const band = complianceBand(f.metrics?.auditComplianceScorePct);
          const color = BAND_HEX[band];
          const overdue = (f.metrics?.overdueCapas ?? 0) > 0;
          return (
            <Marker key={f.id} coordinates={[f.longitude as number, f.latitude as number]}>
              {(band === "red" || overdue) && (
                <circle r={11} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={2} />
              )}
              <circle
                r={hover?.f.id === f.id ? 8 : 6.5}
                fill={color}
                stroke="#ffffff"
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onMouseEnter={onMove(f)}
                onMouseMove={onMove(f)}
                onMouseLeave={() => setHover(null)}
                onClick={() => select(f)}
              />
            </Marker>
          );
        })}
      </ComposableMap>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg px-3 py-2 text-xs leading-snug text-white shadow-lg"
          style={{ left: hover.x + 14, top: hover.y + 14, background: "#0b1f4d", maxWidth: 230 }}
        >
          <div className="font-bold">{hover.f.factoryName}</div>
          <div className="opacity-80">
            {hover.f.factoryCode} · {[hover.f.city, hover.f.state].filter(Boolean).join(", ")}
          </div>
          <div className="mt-1">
            Compliance: <strong>{hover.f.metrics?.auditComplianceScorePct != null ? `${hover.f.metrics.auditComplianceScorePct}%` : "—"}</strong>
            {hover.f.metrics?.openCapas != null && <> · Open CAPAs: <strong>{fmtNum(hover.f.metrics.openCapas)}</strong></>}
          </div>
        </div>
      )}

      {unplottable > 0 && (
        <div className="mt-1 text-right text-[11px] text-slate-400">
          {unplottable} factory{unplottable > 1 ? "ies" : "y"} without geo-coordinates not shown.
        </div>
      )}
    </Card>
  );
}
