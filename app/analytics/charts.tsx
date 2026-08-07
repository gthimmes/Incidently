"use client";

// Lightweight SVG charts following the dataviz mark specs:
// thin marks, 4px rounded data-ends, 2px bar gaps, hairline grid,
// muted axis ink, tabular figures, hover tooltips via <title>.

const GRID = "#1f2b3e";
const MUTED = "#8494ab";
const BLUE = "#3987e5"; // sequential hue, dark-surface step

export function WeeklyBars({
  data,
  height = 180,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const w = 560;
  const padL = 28;
  const padB = 22;
  const padT = 12;
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = w - padL - 8;
  const innerH = height - padT - padB;
  const barW = Math.min(34, innerW / data.length - 2);
  const ticks = max <= 2 ? [0, 1] : [0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      {ticks.map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={padL} x2={w - 8} y1={y} y2={y} stroke={GRID} strokeWidth="1" />
            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
              {Math.round(max * t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padL + (innerW / data.length) * i + (innerW / data.length - barW) / 2;
        const h = (d.value / max) * innerH;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, d.value > 0 ? 3 : 0)} rx="4" fill={BLUE}>
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            {/* clip the bottom rounding by overlaying baseline-anchored rect */}
            {h > 4 && <rect x={x} y={padT + innerH - 4} width={barW} height={4} fill={BLUE} />}
            <text
              x={x + barW / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize="9.5"
              fill={MUTED}
            >
              {d.label}
            </text>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="#e6ebf2" style={{ fontVariantNumeric: "tabular-nums" }}>
                {d.value}
              </text>
            )}
          </g>
        );
      })}
      <line x1={padL} x2={w - 8} y1={padT + innerH} y2={padT + innerH} stroke="#2a3a52" strokeWidth="1" />
    </svg>
  );
}

export function TrendLine({
  data,
  height = 180,
  unit,
}: {
  data: { label: string; value: number | null }[];
  height?: number;
  unit: string;
}) {
  const w = 560;
  const padL = 40;
  const padB = 22;
  const padT = 12;
  const vals = data.map((d) => d.value).filter((v): v is number => v != null);
  const max = Math.max(1, ...vals);
  const innerW = w - padL - 12;
  const innerH = height - padT - padB;
  const pts = data
    .map((d, i) => {
      if (d.value == null) return null;
      const x = padL + (innerW / Math.max(1, data.length - 1)) * i;
      const y = padT + innerH * (1 - d.value / max);
      return { x, y, ...d };
    })
    .filter(Boolean) as { x: number; y: number; label: string; value: number }[];

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      {[0, 0.5, 1].map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={padL} x2={w - 12} y1={y} y2={y} stroke={GRID} strokeWidth="1" />
            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
              {Math.round(max * t)}{unit}
            </text>
          </g>
        );
      })}
      {path && <path d={path} fill="none" stroke={BLUE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="8" fill="transparent">
            <title>{`${p.label}: ${p.value}${unit}`}</title>
          </circle>
          <circle cx={p.x} cy={p.y} r="3.5" fill={BLUE} stroke="#101828" strokeWidth="2" />
        </g>
      ))}
      {data.map((d, i) => {
        const x = padL + (innerW / Math.max(1, data.length - 1)) * i;
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="9.5" fill={MUTED}>
            {d.label}
          </text>
        );
      })}
      <line x1={padL} x2={w - 12} y1={padT + innerH} y2={padT + innerH} stroke="#2a3a52" strokeWidth="1" />
    </svg>
  );
}

/** Labeled row bars — identity is carried by the text label (and optional
 *  entity color swatch), never by hue alone. */
export function RowBars({
  data,
}: {
  data: { label: string; value: number; color?: string; sublabel?: string }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-right text-dim truncate" title={d.label}>
            {d.label}
          </span>
          <div className="flex-1 h-4 rounded-sm overflow-hidden bg-elevated/60 relative" title={`${d.label}: ${d.value}`}>
            <div
              className="h-full rounded-r-[4px]"
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`, background: d.color ?? BLUE }}
            />
          </div>
          <span className="w-8 text-right font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}
