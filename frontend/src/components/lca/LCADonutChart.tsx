import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  stages?: Record<string, number | null>;
  byStage?: Record<string, number | null>;
  loinLevel?: number;
}

const STAGE_CONFIG: { key: string; label: string; color: string; group: string }[] = [
  { key: 'A1', label: 'A1 — Raw material', color: '#1a7a5a', group: 'A1-A3' },
  { key: 'A2', label: 'A2 — Transport to factory', color: '#25a87a', group: 'A1-A3' },
  { key: 'A3', label: 'A3 — Manufacturing', color: '#00c8a0', group: 'A1-A3' },
  { key: 'A4', label: 'A4 — Transport to site', color: '#f4a031', group: 'A4-A5' },
  { key: 'A5', label: 'A5 — Installation', color: '#e8923a', group: 'A4-A5' },
  { key: 'B1-B7', label: 'B1–B7 Use Stage', color: '#555555', group: 'B' },
  { key: 'C1-C4', label: 'C1–C4 End of Life', color: '#e05252', group: 'C' },
  { key: 'D', label: 'D Beyond Boundary', color: '#b07ee8', group: 'D' },
];

// Legacy grouped config for when we get summary data with grouped stages
const GROUPED_STAGE_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'A1-A3', label: 'A1–A3 Product Stage', color: '#00c8a0' },
  { key: 'A4-A5', label: 'A4–A5 Construction', color: '#3b9eff' },
  { key: 'B1-B7', label: 'B1–B7 Use Stage', color: '#f4a031' },
  { key: 'C1-C4', label: 'C1–C4 End of Life', color: '#e05252' },
  { key: 'D', label: 'D Beyond Boundary', color: '#b07ee8' },
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

type StatusTag = 'LIVE' | 'PROJECTED' | 'LOCKED';

export default function LCADonutChart({ stages, byStage, loinLevel = 2 }: Props) {
  // Determine which data source to use: detailed byStage or grouped stages
  const useDetailed = !!byStage && ('A1' in byStage);
  const stageData = byStage || stages || {};

  const config = useDetailed ? STAGE_CONFIG : GROUPED_STAGE_CONFIG;

  const data = config.map(s => {
    const value = stageData[s.key] ?? 0;
    const isNull = stageData[s.key] === null || stageData[s.key] === undefined;
    const isProjected = useDetailed
      ? s.key === 'A4' || s.key === 'A5'
      : s.key === 'A4-A5';
    const isLocked = isNull && (s.key.startsWith('B') || s.key.startsWith('C') || s.key === 'D');

    let tag: StatusTag = 'LIVE';
    if (isLocked) tag = 'LOCKED';
    else if (isProjected) tag = 'PROJECTED';

    return {
      ...s,
      value: typeof value === 'number' ? value : 0,
      projected: isProjected,
      locked: isLocked,
      tag,
    };
  });

  const chartData = data.map(d => ({
    ...d,
    value: d.locked
      ? Math.max((stageData[useDetailed ? 'A3' : 'A1-A3'] ?? 0) * 0.02, 1)
      : d.value || 0.01,
  }));

  const total = data.reduce((sum, d) => sum + (d.locked ? 0 : d.value), 0);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-1">EN 15978 Lifecycle Stages</h3>
      <p className="text-xs text-gray-500 mb-4">
        Carbon impact by lifecycle module. Projected stages use transport defaults; locked stages require LOIN ≥ 4.
      </p>
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: 260, height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={110}
                dataKey="value"
                stroke="none"
                animationBegin={0}
                animationDuration={800}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    opacity={entry.locked ? 0.15 : entry.projected ? 0.5 : 1}
                    strokeDasharray={entry.projected ? '4 4' : entry.locked ? '2 4' : undefined}
                    stroke={entry.projected || entry.locked ? entry.color : 'none'}
                    strokeWidth={entry.projected || entry.locked ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const pct = total > 0 ? (((d.locked ? 0 : d.value) / total) * 100).toFixed(1) : '0';
                  return (
                    <div className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-xs text-white">
                      <p className="font-semibold">{d.label}</p>
                      {d.locked ? (
                        <p className="text-gray-400">Locked — requires LOIN ≥ 4</p>
                      ) : d.projected ? (
                        <p className="text-amber-300">{formatNumber(d.value)} kgCO₂e — projected</p>
                      ) : (
                        <p>{formatNumber(d.value)} kgCO₂e ({pct}%)</p>
                      )}
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-mono font-bold text-white">{formatNumber(total)}</span>
            <span className="text-xs text-gray-400">kgCO₂e</span>
            <span className="text-[10px] text-gray-500 mt-0.5">EN 15978</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center">
          {data.map(d => (
            <div key={d.key} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{
                  backgroundColor: d.color,
                  opacity: d.locked ? 0.2 : d.projected ? 0.5 : 1,
                }}
              />
              <span className="text-gray-300">{d.key}</span>
              {d.locked ? (
                <span className="text-gray-600 font-mono text-[10px] bg-gray-800 px-1 rounded">LOCKED</span>
              ) : d.projected ? (
                <>
                  <span className="text-gray-400 font-mono">{formatNumber(d.value)}</span>
                  <span className="text-amber-600 font-mono text-[10px] bg-amber-900/30 px-1 rounded">PROJECTED</span>
                </>
              ) : (
                <>
                  <span className="text-gray-300 font-mono">{formatNumber(d.value)}</span>
                  {total > 0 && (
                    <span className="text-gray-600">{((d.value / total) * 100).toFixed(0)}%</span>
                  )}
                  <span className="text-green-700 font-mono text-[10px] bg-green-900/30 px-1 rounded">LIVE</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
