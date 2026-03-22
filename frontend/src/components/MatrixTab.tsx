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

export default function MatrixTab({ projectId, disciplines, phases }: Props) {
  const { summary, refreshSummary, drop } = useMatrix(projectId);
  const { sources } = useSources(projectId);

  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [visiblePhaseIds, setVisiblePhaseIds] = useState<Set<number>>(new Set(phases.map(p => p.id)));
  const [visibleDisciplineIds, setVisibleDisciplineIds] = useState<Set<number>>(new Set(disciplines.map(d => d.id)));
  const [browserWidth, setBrowserWidth] = useState(BROWSER_DEFAULT);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(BROWSER_DEFAULT);

  // Keep filter sets in sync as phases/disciplines change
  useEffect(() => {
    setVisiblePhaseIds(new Set(phases.map(p => p.id)));
  }, [phases.length]);

  useEffect(() => {
    setVisibleDisciplineIds(new Set(disciplines.map(d => d.id)));
  }, [disciplines.length]);

  // ── Resize drag handlers ──────────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = browserWidth;

    function onMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      // Handle is on the left edge of the browser — drag left = wider, drag right = narrower
      const delta = dragStartX.current - ev.clientX;
      const newWidth = Math.max(BROWSER_MIN, Math.min(BROWSER_MAX, dragStartWidth.current + delta));
      setBrowserWidth(newWidth);
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

  // ── Filters ───────────────────────────────────────────────────────────────
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
    setVisiblePhaseIds(new Set(phases.map(p => p.id)));
    setVisibleDisciplineIds(new Set(disciplines.map(d => d.id)));
  }

  // ── Cell interaction ──────────────────────────────────────────────────────
  function handleCellClick(disciplineId: number, phaseId: number) {
    if (selectedCell?.disciplineId === disciplineId && selectedCell?.phaseId === phaseId) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ disciplineId, phaseId });
    }
  }

  async function handleDrop(disciplineId: number, phaseId: number, payload: any) {
    await drop(disciplineId, phaseId, payload);
  }

  const selectedDiscipline = selectedCell ? disciplines.find(d => d.id === selectedCell.disciplineId) : null;
  const selectedPhase = selectedCell ? phases.find(p => p.id === selectedCell.phaseId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">Discipline × Phase Matrix</h2>
        <button
          onClick={refreshSummary}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="flex items-start" style={{ paddingBottom: selectedCell ? '420px' : 0 }}>
        {/* Left: matrix grid */}
        <div className="flex-1 min-w-0 space-y-2">
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

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="flex-shrink-0 w-2 mx-1 self-stretch flex items-center justify-center cursor-col-resize group"
          title="Drag to resize"
        >
          <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 transition-colors rounded-full" />
        </div>

        {/* Right: IDS browser */}
        <div
          className="flex-shrink-0 sticky top-0"
          style={{ width: browserWidth, height: 'calc(100vh - 200px)' }}
        >
          <IDSBrowserPanel projectId={projectId} sources={sources} />
        </div>
      </div>

      {/* Cell edit panel */}
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
        />
      )}
    </div>
  );
}
