"use client";

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, AreaChart, Area
} from "recharts";

const PRIMARY = "#7c3aed";
const COLORS = ["#7c3aed", "#a78bfa", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#06b6d4", "#ec4899"];

export function ObservationsTrendChart({ data }: { data: { month: string; observations: number; nearMiss: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-obs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.4} />
            <stop offset="95%" stopColor={PRIMARY} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="grad-nm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
        <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="observations" name="Observations" stroke={PRIMARY} fill="url(#grad-obs)" strokeWidth={2} />
        <Area type="monotone" dataKey="nearMiss" name="Near Miss" stroke="#f59e0b" fill="url(#grad-nm)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HeinrichPyramid({ data }: { data: { level: string; count: number; color: string }[] }) {
  if (data.length === 0) return null;
  const n = data.length;

  // Pyramid geometry in viewBox units — scales to any container width
  const BAND_H  = 32;          // height of each horizontal band
  const CX      = 130;         // horizontal centre of the pyramid
  const BASE_HW = 120;         // half-width of the widest (bottom) band
  const LABEL_X = CX + BASE_HW + 18;  // where label text starts
  const COUNT_X = 378;         // x for right-aligned count numbers
  const SVG_W   = 386;
  const SVG_H   = n * BAND_H + 4;
  const MT      = 2;           // top margin

  return (
    <div className="w-full select-none">
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: "block" }}>
        {data.map((d, i) => {
          const y0   = MT + i * BAND_H;
          const y1   = MT + (i + 1) * BAND_H;
          const midY = (y0 + y1) / 2;

          // Half-widths grow linearly from apex (0) to base (BASE_HW)
          const hw0 = BASE_HW * (i / n);
          const hw1 = BASE_HW * ((i + 1) / n);

          const pts = [
            `${CX - hw0},${y0}`,
            `${CX + hw0},${y0}`,
            `${CX + hw1},${y1}`,
            `${CX - hw1},${y1}`,
          ].join(" ");

          // Right edge of the trapezoid at its vertical mid-point
          const rightEdgeMid = CX + (hw0 + hw1) / 2;
          const bandW = hw1 * 2;

          return (
            <g key={i}>
              {/* Trapezoid band */}
              <polygon points={pts} fill={d.color} stroke="#fff" strokeWidth={2} />

              {/* Count inside band — only when there's room */}
              {bandW >= 26 && (
                <text
                  x={CX} y={midY}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#fff" fontSize={bandW > 72 ? 13 : 10} fontWeight="700"
                >
                  {d.count}
                </text>
              )}

              {/* Dotted connector from right edge to label area */}
              <line
                x1={rightEdgeMid + 2} y1={midY}
                x2={LABEL_X - 5}     y2={midY}
                stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 2"
              />

              {/* Level label */}
              <text
                x={LABEL_X} y={midY}
                textAnchor="start" dominantBaseline="middle"
                fill="#374151" fontSize={11} fontWeight="500"
              >
                {d.level}
              </text>

              {/* Coloured count on the far right */}
              <text
                x={COUNT_X} y={midY}
                textAnchor="end" dominantBaseline="middle"
                fill={d.color} fontSize={12} fontWeight="700"
              >
                {d.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function PermitsByTypeChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrainingComplianceChart({ data }: { data: { dept: string; compliance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="dept" tick={{ fontSize: 11 }} stroke="#64748b" angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 12 }} stroke="#64748b" domain={[0, 100]} />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
        <Bar dataKey="compliance" name="Compliance %" fill={PRIMARY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InspectionStackedChart({ data }: { data: { plant: string; Done: number; Due: number; Overdue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="plant" tick={{ fontSize: 12 }} stroke="#64748b" />
        <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Done" stackId="a" fill="#10b981" />
        <Bar dataKey="Due" stackId="a" fill="#f59e0b" />
        <Bar dataKey="Overdue" stackId="a" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopUnsafeCategoryChart({ data }: { data: { category: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#64748b" />
        <YAxis type="category" dataKey="category" width={140} tick={{ fontSize: 11 }} stroke="#64748b" />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
        <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LtifrTrendChart({ data }: { data: { month: string; ltifr: number; trir: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
        <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="ltifr" name="LTIFR" stroke={PRIMARY} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="trir" name="TRIR" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
