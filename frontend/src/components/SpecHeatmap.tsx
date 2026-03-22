import React from 'react';
import type { HeatmapRow } from '../types/dashboard';

interface Props {
  rows: HeatmapRow[];
  onCellClick?: (specId: string, phaseId: number, runId: number | null) => void;
}

function cellColor(passRate: number | null): string {
  if (passRate === null) return 'bg-gray-100 dark:bg-gray-800 text-gray-400';
  if (passRate >= 0.9) return 'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300';
  if (passRate >= 0.6) return 'bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300';
  return 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300';
}

export default function SpecHeatmap({ rows, onCellClick }: Props) {
  if (rows.length === 0) {
    return <div className="text-sm text-gray-400 text-center py-8">No specification data.</div>;
  }

  const phases = rows[0]?.cells.map(c => ({ id: c.phase_id, name: c.phase_name })) ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-gray-500 font-medium">Specification</th>
            {phases.map(ph => (
              <th key={ph.id} className="px-2 py-2 text-gray-500 font-medium text-center min-w-[80px]">
                {ph.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(row => (
            <tr key={row.spec_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300 max-w-[180px] truncate" title={row.spec_name}>
                {row.spec_name}
              </td>
              {row.cells.map(cell => (
                <td key={cell.phase_id} className="px-2 py-2 text-center">
                  <button
                    onClick={() => cell.run_id && onCellClick?.(row.spec_id, cell.phase_id, cell.run_id)}
                    disabled={!cell.run_id}
                    title={cell.pass_rate !== null ? `${Math.round(cell.pass_rate * 100)}% pass` : 'Not validated'}
                    className={`w-full px-2 py-1 rounded text-xs font-medium transition-opacity ${cellColor(cell.pass_rate)} ${cell.run_id ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                  >
                    {cell.pass_rate !== null ? `${Math.round(cell.pass_rate * 100)}%` : '—'}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
