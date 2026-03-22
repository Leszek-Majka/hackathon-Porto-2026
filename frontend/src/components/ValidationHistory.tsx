import React from 'react';
import type { ValidationRun } from '../types/validation';
import type { Phase } from '../types/project';

interface Props {
  runs: ValidationRun[];
  phases: Phase[];
  activeRunId: number | null;
  onSelect: (run: ValidationRun) => void;
  onDelete: (runId: number) => void;
  selectedRunId: number | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  complete: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

export default function ValidationHistory({ runs, phases, activeRunId, onSelect, onDelete, selectedRunId }: Props) {
  const phaseMap = Object.fromEntries(phases.map(p => [p.id, p]));

  if (runs.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No validation runs yet.</p>;
  }

  return (
    <div className="space-y-2">
      {runs.map(run => {
        const phase = phaseMap[run.phase_id];
        const isActive = run.id === activeRunId;
        const passRate = run.summary?.pass_rate;

        return (
          <div
            key={run.id}
            onClick={() => run.status === 'complete' && onSelect(run)}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              selectedRunId === run.id
                ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
            } ${run.status === 'complete' ? 'cursor-pointer' : ''}`}
          >
            {phase && (
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {phase?.name ?? `Phase ${run.phase_id}`}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[run.status] ?? STATUS_STYLES.pending}`}>
                  {isActive && run.status === 'running' ? (
                    <span className="flex items-center gap-1">
                      <div className="animate-spin rounded-full h-2.5 w-2.5 border-b border-current" />
                      running
                    </span>
                  ) : run.status}
                </span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {new Date(run.run_at).toLocaleString()}
                {passRate !== undefined && passRate !== null && (
                  <span className={`ml-2 font-medium ${passRate >= 0.9 ? 'text-green-600' : passRate >= 0.6 ? 'text-amber-600' : 'text-red-600'}`}>
                    {Math.round(passRate * 100)}% pass
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(run.id); }}
              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0"
              title="Delete run"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
