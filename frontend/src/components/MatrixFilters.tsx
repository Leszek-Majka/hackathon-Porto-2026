import React from 'react';
import type { Discipline } from '../types/setup';
import type { Phase } from '../types/project';

interface Props {
  phases: Phase[];
  disciplines: Discipline[];
  visiblePhaseIds: Set<number>;
  visibleDisciplineIds: Set<number>;
  onTogglePhase: (id: number) => void;
  onToggleDiscipline: (id: number) => void;
  onReset: () => void;
}

export default function MatrixFilters({
  phases, disciplines,
  visiblePhaseIds, visibleDisciplineIds,
  onTogglePhase, onToggleDiscipline, onReset,
}: Props) {
  const allVisible =
    phases.every(p => visiblePhaseIds.has(p.id)) &&
    disciplines.every(d => visibleDisciplineIds.has(d.id));

  return (
    <div className="flex items-center gap-4 py-2 px-1 flex-wrap">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Filter:</span>

      {/* Phases */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-gray-400 dark:text-gray-500">Phases:</span>
        {phases.map(p => (
          <button
            key={p.id}
            onClick={() => onTogglePhase(p.id)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              visiblePhaseIds.has(p.id)
                ? 'text-white border-transparent'
                : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 opacity-50'
            }`}
            style={visiblePhaseIds.has(p.id) ? { backgroundColor: p.color, borderColor: p.color } : {}}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Disciplines */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-gray-400 dark:text-gray-500">Disciplines:</span>
        {disciplines.map(d => (
          <button
            key={d.id}
            onClick={() => onToggleDiscipline(d.id)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              visibleDisciplineIds.has(d.id)
                ? 'text-white border-transparent'
                : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 opacity-50'
            }`}
            style={visibleDisciplineIds.has(d.id) ? { backgroundColor: d.color, borderColor: d.color } : {}}
          >
            {d.abbreviation || d.name}
          </button>
        ))}
      </div>

      {!allVisible && (
        <button
          onClick={onReset}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Reset
        </button>
      )}
    </div>
  );
}
