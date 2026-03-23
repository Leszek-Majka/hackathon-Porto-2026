import React from 'react';
import type { LCASummary, DisciplineBreakdown } from '../../types/lca';

interface Props {
  // Accept either legacy summary or check-based byDiscipline
  summary?: LCASummary;
  byDiscipline?: Record<string, DisciplineBreakdown>;
  totalMass?: number;
  totalA1A3?: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

export default function LCADisciplineBreakdownTable({ summary, byDiscipline, totalMass, totalA1A3 }: Props) {
  // Build rows from either data source
  const rows: Array<{ code: string; name: string; color: string; mass_kg: number; gwp_a1a3: number; pass: number; warn: number; fail: number }> = [];

  if (byDiscipline) {
    for (const [code, bd] of Object.entries(byDiscipline)) {
      rows.push({
        code,
        name: code,
        color: bd.color,
        mass_kg: bd.mass_kg,
        gwp_a1a3: bd.gwp_a1a3,
        pass: bd.pass_count,
        warn: bd.warn_count,
        fail: bd.fail_count,
      });
    }
  } else if (summary) {
    for (const d of summary.by_discipline ?? []) {
      rows.push({
        code: d.code,
        name: d.name,
        color: d.color,
        mass_kg: d.mass_kg,
        gwp_a1a3: d.gwp_a1a3,
        pass: 0,
        warn: 0,
        fail: 0,
      });
    }
  }

  if (rows.length === 0) return null;

  const tMass = totalMass ?? (summary?.ils17_mass_kg || 1);
  const tA1 = totalA1A3 ?? (summary?.ils18_gwp_a1a3 || 1);
  const hasCheckData = rows.some(r => r.pass + r.warn + r.fail > 0);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">Discipline breakdown</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Mass and global warming potential (GWP) by discipline for the current filters.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
              <th className="px-4 py-2 font-medium">Discipline</th>
              <th className="px-4 py-2 font-medium text-right">Mass (kg)</th>
              <th className="px-4 py-2 font-medium text-right">Share</th>
              <th className="px-4 py-2 font-medium text-right">GWP A1–A3 (kgCO₂e)</th>
              <th className="px-4 py-2 font-medium text-right">Share</th>
              {hasCheckData && (
                <th className="px-4 py-2 font-medium text-right">Status</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(d => (
              <tr key={d.code} className="border-b border-gray-800/80 hover:bg-gray-800/40">
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-200">{d.name}</span>
                    <span className="text-gray-500 font-mono text-xs">{d.code}</span>
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono text-blue-300">{formatNumber(d.mass_kg)}</td>
                <td className="px-4 py-2 text-right text-gray-400">
                  {tMass > 0 ? ((d.mass_kg / tMass) * 100).toFixed(1) : '0.0'}%
                </td>
                <td className="px-4 py-2 text-right font-mono text-teal-300">{formatNumber(d.gwp_a1a3)}</td>
                <td className="px-4 py-2 text-right text-gray-400">
                  {tA1 > 0 ? ((d.gwp_a1a3 / tA1) * 100).toFixed(1) : '0.0'}%
                </td>
                {hasCheckData && (
                  <td className="px-4 py-2 text-right">
                    <span className="inline-flex gap-1.5 text-[10px]">
                      {d.pass > 0 && <span className="text-green-400">{d.pass}✓</span>}
                      {d.warn > 0 && <span className="text-amber-400">{d.warn}!</span>}
                      {d.fail > 0 && <span className="text-red-400">{d.fail}✗</span>}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
