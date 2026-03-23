import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { LCASummary, DisciplineBreakdown } from '../../types/lca';

interface Props {
  // Accept either summary (legacy) or check-based by_discipline
  summary?: LCASummary;
  byDiscipline?: Record<string, DisciplineBreakdown>;
  onFilter?: (disciplineCode: string, stageGroup: string) => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

export default function LCADisciplineStackedBar({ summary, byDiscipline, onFilter }: Props) {
  // Build discipline list from either source
  const disciplines: Array<{ code: string; name: string; color: string; gwp_a1a3: number; gwp_a4a5: number }> = [];

  if (byDiscipline) {
    for (const [code, bd] of Object.entries(byDiscipline)) {
      disciplines.push({
        code,
        name: code,
        color: bd.color,
        gwp_a1a3: bd.gwp_a1a3,
        gwp_a4a5: bd.gwp_a4a5,
      });
    }
  } else if (summary?.by_discipline_stages) {
    for (const d of summary.by_discipline_stages) {
      disciplines.push({
        code: d.code,
        name: d.name,
        color: d.color,
        gwp_a1a3: d.stages['A1-A3'] ?? 0,
        gwp_a4a5: d.stages['A4-A5'] ?? 0,
      });
    }
  }

  if (disciplines.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">GWP by discipline</h3>
        <p className="text-sm text-gray-500 py-12 text-center">No discipline data to display.</p>
      </div>
    );
  }

  // Chart data: X = discipline, stacked = A1-A3 (solid) + A4-A5 (lighter)
  const chartData = disciplines.map(d => ({
    discipline: d.code,
    'A1-A3': d.gwp_a1a3,
    'A4-A5': d.gwp_a4a5,
    color: d.color,
  }));

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-1">
        GWP by discipline
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        A1–A3 (solid) and A4–A5 projected (faded) per discipline.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="discipline" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={formatNumber} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #4b5563',
              borderRadius: 8,
            }}
            labelStyle={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}
            itemStyle={{ color: '#d1d5db', fontSize: 12 }}
            formatter={(value: number, name: string) => [
              `${formatNumber(value)} kgCO₂e`,
              name,
            ]}
            labelFormatter={label => `Discipline: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
          <Bar
            dataKey="A1-A3"
            stackId="a"
            name="A1–A3 Product"
            fill="#00c8a0"
          />
          <Bar
            dataKey="A4-A5"
            stackId="a"
            name="A4–A5 Projected"
            fill="#f4a031"
            opacity={0.5}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
