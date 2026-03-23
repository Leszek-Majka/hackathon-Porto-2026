import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMatrix } from '../hooks/useMatrix';
import { useSources } from '../hooks/useSources';
import type { Discipline } from '../types/setup';
import type { Phase } from '../types/project';
import MatrixGrid from './MatrixGrid';
import MatrixFilters from './MatrixFilters';
import IDSBrowserPanel from './IDSBrowserPanel';
import CellEditPanel from './CellEditPanel';

interface SelectedCell {
  disciplineId: number;
  phaseId: number;
}

interface Props {
  projectId: number;
  disciplines: Discipline[];
  phases: Phase[];
}

const BROWSER_MIN = 200;
const BROWSER_MAX = 600;
const BROWSER_DEFAULT = 288;
const CELL_PANEL_TOTAL = 'calc(22rem + 42px)';

export default function MatrixTab({ projectId, disciplines, phases }: Props) {
  const { summary, refreshSummary, drop } = useMatrix(projectId);
  const { sources } = useSources(projectId);

  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [cellRefreshToken, setCellRefreshToken] = useState(0);
  const [visiblePhaseIds, setVisiblePhaseIds] = useState<Set<number>>(new Set(phases.map(phase => phase.id)));
  const [visibleDisciplineIds, setVisibleDisciplineIds] = useState<Set<number>>(new Set(disciplines.map(discipline => discipline.id)));
  const [browserWidth, setBrowserWidth] = useState(BROWSER_DEFAULT);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(BROWSER_DEFAULT);

  useEffect(() => {
    setVisiblePhaseIds(new Set(phases.map(phase => phase.id)));
  }, [phases.length]);

  useEffect(() => {
    setVisibleDisciplineIds(new Set(disciplines.map(discipline => discipline.id)));
  }, [disciplines.length]);

  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    isDragging.current = true;
    dragStartX.current = event.clientX;
    dragStartWidth.current = browserWidth;

    function onMove(moveEvent: MouseEvent) {
      if (!isDragging.current) return;
      const delta = dragStartX.current - moveEvent.clientX;
      setBrowserWidth(Math.max(BROWSER_MIN, Math.min(BROWSER_MAX, dragStartWidth.current + delta)));
    }

    function onUp() {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [browserWidth]);

  function togglePhase(id: number) {
    setVisiblePhaseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDiscipline(id: number) {
    setVisibleDisciplineIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    setVisiblePhaseIds(new Set(phases.map(phase => phase.id)));
    setVisibleDisciplineIds(new Set(disciplines.map(discipline => discipline.id)));
  }

  function handleCellClick(disciplineId: number, phaseId: number) {
    if (selectedCell?.disciplineId === disciplineId && selectedCell?.phaseId === phaseId) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ disciplineId, phaseId });
    }
  }

  async function handleDrop(disciplineId: number, phaseId: number, payload: any) {
    await drop(disciplineId, phaseId, payload);
    refreshSummary();
    if (selectedCell?.disciplineId === disciplineId && selectedCell?.phaseId === phaseId) {
      setCellRefreshToken(token => token + 1);
    }
  }

  const selectedDiscipline = selectedCell ? disciplines.find(discipline => discipline.id === selectedCell.disciplineId) : null;
  const selectedPhase = selectedCell ? phases.find(phase => phase.id === selectedCell.phaseId) : null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">IDS Split/Merge</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Assign imported IDS requirements to discipline and phase cells, then refine them directly in the matrix.
          </p>
        </div>
        <button
          onClick={refreshSummary}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ paddingBottom: selectedCell ? CELL_PANEL_TOTAL : '1rem' }}
        >
          <div className="space-y-2">
            <MatrixFilters
              phases={phases}
              disciplines={disciplines}
              visiblePhaseIds={visiblePhaseIds}
              visibleDisciplineIds={visibleDisciplineIds}
              onTogglePhase={togglePhase}
              onToggleDiscipline={toggleDiscipline}
              onReset={resetFilters}
            />
            <MatrixGrid
              projectId={projectId}
              disciplines={disciplines}
              phases={phases}
              summary={summary}
              visiblePhaseIds={visiblePhaseIds}
              visibleDisciplineIds={visibleDisciplineIds}
              selectedCell={selectedCell}
              onCellClick={handleCellClick}
              onDrop={handleDrop}
            />
          </div>
        </div>

        <div
          onMouseDown={handleResizeStart}
          className="flex-shrink-0 w-2 mx-1 flex items-center justify-center cursor-col-resize group self-stretch"
          title="Drag to resize"
        >
          <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 transition-colors rounded-full" />
        </div>

        <div className="flex-shrink-0 h-full" style={{ width: browserWidth }}>
          <IDSBrowserPanel projectId={projectId} sources={sources} />
        </div>
      </div>

      {selectedCell && selectedDiscipline && selectedPhase && (
        <CellEditPanel
          projectId={projectId}
          disciplineId={selectedCell.disciplineId}
          phaseId={selectedCell.phaseId}
          disciplineName={selectedDiscipline.name}
          phaseName={selectedPhase.name}
          sources={sources}
          onClose={() => setSelectedCell(null)}
          onChanged={refreshSummary}
          refreshToken={cellRefreshToken}
        />
      )}
    </div>
  );
}
