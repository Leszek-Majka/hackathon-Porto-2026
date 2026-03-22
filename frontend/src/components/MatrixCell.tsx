import React, { useState } from 'react';
import type { CellSummary, DropPayload } from '../types/matrix';
import ApplyToAllDialog from './ApplyToAllDialog';

interface Props {
  projectId: number;
  disciplineId: number;
  phaseId: number;
  disciplineName: string;
  summary: CellSummary | undefined;
  isSelected: boolean;
  onClick: () => void;
  onDrop: (payload: any) => Promise<void>;
}

export default function MatrixCell({
  projectId, disciplineId, phaseId, disciplineName,
  summary, isSelected, onClick, onDrop,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{ raw: DropPayload } | null>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    try {
      const raw = JSON.parse(e.dataTransfer.getData('application/json')) as DropPayload;
      if (raw.dropType === 'specification' || raw.dropType === 'ids' || raw.dropType === 'multi_specification') {
        // Ask whether to apply to all phases
        setPendingPayload({ raw });
      } else {
        await submitDrop(raw, false);
      }
    } catch (err) {
      console.error('Drop parse error:', err);
    }
  }

  async function submitDrop(raw: DropPayload, applyToAll: boolean) {
    const payload = {
      source_ids_id: raw.sourceIdsId,
      drop_type: raw.dropType,
      spec_name: raw.specName,
      spec_names: raw.specNames ?? [],
      applicability_index: raw.applicabilityIndex,
      requirement_index: raw.requirementIndex,
      apply_to_all_phases: applyToAll,
    };
    await onDrop(payload);
  }

  const isEmpty = !summary || summary.entry_count === 0;

  return (
    <>
      <td
        onClick={onClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative p-2 cursor-pointer transition-all border border-transparent ${
          isSelected
            ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-inset ring-indigo-500'
            : dragOver
            ? 'bg-green-50 dark:bg-green-900/20 border-dashed border-green-400 ring-2 ring-inset ring-green-400'
            : isEmpty
            ? 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
            : 'hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'
        }`}
        style={{ minWidth: '100px', height: '56px' }}
      >
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-green-600 dark:text-green-400 text-xs font-medium">Drop here</span>
          </div>
        )}
        {!dragOver && !isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-0.5">
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              {summary!.spec_count} spec{summary!.spec_count !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {summary!.entry_count} req
            </span>
          </div>
        )}
        {!dragOver && isEmpty && (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-300 dark:text-gray-600 text-lg">+</span>
          </div>
        )}
      </td>

      {pendingPayload && (
        <ApplyToAllDialog
          disciplineName={disciplineName}
          onThisPhaseOnly={async () => {
            const p = pendingPayload.raw;
            setPendingPayload(null);
            await submitDrop(p, false);
          }}
          onAllPhases={async () => {
            const p = pendingPayload.raw;
            setPendingPayload(null);
            await submitDrop(p, true);
          }}
          onCancel={() => setPendingPayload(null)}
        />
      )}
    </>
  );
}
