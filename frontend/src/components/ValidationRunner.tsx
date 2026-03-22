import React, { useState } from 'react';
import type { Phase } from '../types/project';

interface Props {
  phases: Phase[];
  activeRunId: number | null;
  loading: boolean;
  onRun: (phaseId: number) => void;
}

export default function ValidationRunner({ phases, activeRunId, loading, onRun }: Props) {
  const [selectedPhase, setSelectedPhase] = useState<number>(phases[0]?.id ?? 0);
  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">Validate against phase:</label>
      <select
        value={selectedPhase}
        onChange={e => setSelectedPhase(Number(e.target.value))}
        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={!!activeRunId || loading}
      >
        {sortedPhases.map(ph => (
          <option key={ph.id} value={ph.id}>{ph.name}</option>
        ))}
      </select>
      <button
        onClick={() => onRun(selectedPhase)}
        disabled={!!activeRunId || loading || !selectedPhase}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
      >
        {activeRunId || loading ? (
          <>
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
            Running...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run Validation
          </>
        )}
      </button>
    </div>
  );
}
