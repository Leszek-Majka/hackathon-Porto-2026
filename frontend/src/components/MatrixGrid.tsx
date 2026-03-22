import React from 'react';
import type { Discipline } from '../types/setup';
import type { Phase } from '../types/project';
import type { CellSummary } from '../types/matrix';
import MatrixCellComponent from './MatrixCell';

interface SelectedCell {
  disciplineId: number;
  phaseId: number;
}

interface Props {
  projectId: number;
  disciplines: Discipline[];
  phases: Phase[];
  summary: CellSummary[];
  visiblePhaseIds: Set<number>;
  visibleDisciplineIds: Set<number>;
  selectedCell: SelectedCell | null;
  onCellClick: (disciplineId: number, phaseId: number) => void;
  onDrop: (disciplineId: number, phaseId: number, payload: any) => Promise<void>;
}

export default function MatrixGrid({
  projectId, disciplines, phases, summary,
  visiblePhaseIds, visibleDisciplineIds,
  selectedCell, onCellClick, onDrop,
}: Props) {
  const visiblePhases = phases.filter(p => visiblePhaseIds.has(p.id));
  const visibleDisciplines = disciplines.filter(d => visibleDisciplineIds.has(d.id));

  if (visibleDisciplines.length === 0 || visiblePhases.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
          {disciplines.length === 0 || phases.length === 0
            ? 'Add disciplines and phases in the Setup tab to start building your matrix.'
            : 'No disciplines or phases visible. Adjust filters above.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            {/* Sticky corner */}
            <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-r border-b border-gray-200 dark:border-gray-700 min-w-[140px]">
              Discipline
            </th>
            {visiblePhases.map(p => (
              <th key={p.id} className="px-2 py-2.5 text-center border-b border-gray-200 dark:border-gray-700 min-w-[100px]">
                <div className="flex items-center justify-center">
                  <span
                    className="text-xs font-medium text-white px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleDisciplines.map(d => (
            <tr key={d.id} className="border-t border-gray-200 dark:border-gray-700">
              {/* Sticky discipline header */}
              <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <div>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{d.name}</span>
                    {d.abbreviation && (
                      <span className="ml-1 font-mono text-xs text-gray-400 dark:text-gray-500">({d.abbreviation})</span>
                    )}
                  </div>
                </div>
              </td>
              {visiblePhases.map(p => {
                const cellSummary = summary.find(s => s.discipline_id === d.id && s.phase_id === p.id);
                const isSel = selectedCell?.disciplineId === d.id && selectedCell?.phaseId === p.id;
                return (
                  <MatrixCellComponent
                    key={p.id}
                    projectId={projectId}
                    disciplineId={d.id}
                    phaseId={p.id}
                    disciplineName={d.name}
                    summary={cellSummary}
                    isSelected={isSel}
                    onClick={() => onCellClick(d.id, p.id)}
                    onDrop={payload => onDrop(d.id, p.id, payload)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
