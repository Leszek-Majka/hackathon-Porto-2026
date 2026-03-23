import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { LCASummary } from '../../types/lca';
import type { Discipline } from '../../types/setup';

interface Props {
  summary: LCASummary;
  disciplines: Discipline[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

const GATE_PHASES = [
  { code: 'R2', label: 'SD' },
  { code: 'R3', label: 'DD' },
  { code: 'R4', label: 'TD' },
];

export default function LCAPhaseLineChart({ summary, disciplines }: Props) {
  // Build data: one point per RIBA phase
  const chartData = summary.by_riba_phase.map(p => {
    const row: Record<string, string | number | null> = {
      phase: p.phase_code,
      name: p.phase_name,
      total: p.gwp_total,
    };
    // Distribute across disciplines proportionally
    if (p.gwp_total !== null) {
      const totalA1A3 = summary.ils18_gwp_a1a3 || 1;
      for (const d of summary.by_discipline) {
        const ratio = d.gwp_a1a3 / totalA1A3;
        row[d.code] = Math.round((p.gwp_total ?? 0) * ratio);
      }
    } else {
      for (const d of summary.by_discipline) {
        row[d.code] = null;
      }
    }
    return row;
  });

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-1">GWP by RIBA phase (cumulative A1–A3)</h3>
      <p className="text-xs text-gray-500 mb-4">
        One line per discipline plus total. Vertical markers: concept design (SD), spatial coordination (DD),
        technical design (TD). Phases without LCA entries show no value.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="phase" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={formatNumber} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
            itemStyle={{ color: '#d1d5db', fontSize: 12 }}
            formatter={(value) => {
              const v = value as number | null;
              return v !== null ? `${formatNumber(v)} kgCO₂e` : '—';
            }}
            labelFormatter={label => {
              const p = chartData.find(d => d.phase === label);
              return p ? `${p.phase} — ${p.name}` : String(label);
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
          {GATE_PHASES.map(g => (
            <ReferenceLine
              key={g.code}
              x={g.code}
              stroke="#6b7280"
              strokeDasharray="4 4"
              label={{ value: g.label, position: 'top', fill: '#9ca3af', fontSize: 11 }}
            />
          ))}
          {summary.by_discipline.map(d => (
            <Line
              key={d.code}
              type="monotone"
              dataKey={d.code}
              stroke={d.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
              name={d.name}
            />
          ))}
          <Line
            type="monotone"
            dataKey="total"
            stroke="#e5e7eb"
            strokeWidth={2.5}
            dot={{ r: 4 }}
            connectNulls={false}
            name="Total"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
