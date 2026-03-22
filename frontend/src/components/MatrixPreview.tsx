import React from 'react';
import type { Discipline } from '../types/setup';
import type { Phase } from '../types/project';

interface Props {
  disciplines: Discipline[];
  phases: Phase[];
}

export default function MatrixPreview({ disciplines, phases }: Props) {
  if (disciplines.length === 0 || phases.length === 0) {
    return (
      <div className="mt-6 p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Matrix preview will appear here once you add both disciplines and phases.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Matrix Preview</h3>
      <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium border-r border-gray-200 dark:border-gray-700 min-w-[120px]">
                Discipline
              </th>
              {phases.map(p => (
                <th key={p.id} className="px-3 py-2 text-center font-medium min-w-[80px]">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-white text-xs"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {disciplines.map(d => (
              <tr key={d.id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="font-medium text-gray-700 dark:text-gray-300">{d.name}</span>
                  </div>
                </td>
                {phases.map(p => (
                  <td key={p.id} className="px-3 py-2 text-center">
                    <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded border border-dashed border-gray-300 dark:border-gray-600" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
