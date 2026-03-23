import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useDragContext } from '../dnd/DragContext';
import type { IDSSource, IDSParsed, IDSSpec } from '../types/sources';
import type { DropPayload } from '../types/matrix';
import { SpecDragNode, RequirementDragNode } from './IDSTreeNode';
import ApplicabilityChips from './ApplicabilityChips';

interface Props {
  source: IDSSource;
  projectId: number;
}

export default function IDSTreeBrowser({ source, projectId }: Props) {
  const [parsed, setParsed] = useState<IDSParsed | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());
  const [selectedSpecIds, setSelectedSpecIds] = useState<Set<string>>(new Set());
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const { setDragging } = useDragContext();

  // Always reset and reload when source changes
  useEffect(() => {
    setParsed(null);
    setExpandedSpecs(new Set());
    setSelectedSpecIds(new Set());
    setLastClickedIdx(null);
    setLoading(true);

    api.sources.get(projectId, source.id)
      .then(s => setParsed(s.parsed ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [source.id, projectId]);

  function toggleExpand(specId: string) {
    setExpandedSpecs(prev => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  }

  function handleSpecClick(e: React.MouseEvent, specId: string, specIdx: number, specs: IDSSpec[]) {
    if (e.ctrlKey || e.metaKey) {
      // Toggle single
      setSelectedSpecIds(prev => {
        const next = new Set(prev);
        if (next.has(specId)) next.delete(specId);
        else next.add(specId);
        return next;
      });
      setLastClickedIdx(specIdx);
    } else if (e.shiftKey && lastClickedIdx !== null) {
      // Range select
      const from = Math.min(lastClickedIdx, specIdx);
      const to = Math.max(lastClickedIdx, specIdx);
      const rangeIds = new Set(specs.slice(from, to + 1).map((s, i) => s.id ?? `spec_${from + i}`));
      setSelectedSpecIds(prev => new Set([...prev, ...rangeIds]));
    } else {
      // Toggle single (without modifiers clears others)
      setSelectedSpecIds(prev => {
        if (prev.size === 1 && prev.has(specId)) return new Set();
        return new Set([specId]);
      });
      setLastClickedIdx(specIdx);
    }
  }

  function clearSelection() {
    setSelectedSpecIds(new Set());
    setLastClickedIdx(null);
  }

  // Build drag payload for selected specs
  function buildMultiPayload(specs: IDSSpec[]): DropPayload {
    const selectedNames = specs
      .filter((s, i) => selectedSpecIds.has(s.id ?? `spec_${i}`))
      .map(s => s.name);
    return {
      sourceIdsId: source.id,
      dropType: 'multi_specification',
      specName: '',
      specNames: selectedNames,
      applicabilityIndex: null,
      requirementIndex: null,
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!parsed || !parsed.specifications?.length) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 py-3 px-2">No specifications found.</p>;
  }

  const specs = parsed.specifications;
  const selectedCount = selectedSpecIds.size;

  // IDS-level drag payload
  const idsPayload: DropPayload = {
    sourceIdsId: source.id,
    dropType: 'ids',
    specName: '',
    applicabilityIndex: null,
    requirementIndex: null,
  };

  return (
    <div className="space-y-1">
      {/* Drag entire IDS */}
      <div
        draggable
        onDragStart={e => {
          e.dataTransfer.setData('application/json', JSON.stringify(idsPayload));
          e.dataTransfer.effectAllowed = 'copy';
          setDragging(idsPayload);
        }}
        onDragEnd={() => setDragging(null)}
        title="Drag to add all specifications from this IDS file"
        className="group flex items-center gap-2 px-2 py-1.5 mb-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 cursor-grab active:cursor-grabbing select-none"
      >
        <span className="text-indigo-400 group-hover:text-indigo-600 text-sm">⠿</span>
        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 truncate flex-1">
          {source.title || source.filename}
        </span>
        <span className="text-xs text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded font-mono">
          {specs.length} specs
        </span>
      </div>

      {/* Multi-select drag bar */}
      {selectedCount > 0 && (
        <div
          draggable
          onDragStart={e => {
            const payload = buildMultiPayload(specs);
            e.dataTransfer.setData('application/json', JSON.stringify(payload));
            e.dataTransfer.effectAllowed = 'copy';
            setDragging(payload);
          }}
          onDragEnd={() => { setDragging(null); clearSelection(); }}
          className="group flex items-center gap-2 px-2 py-1.5 mb-1 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 cursor-grab active:cursor-grabbing select-none"
        >
          <span className="text-green-500 group-hover:text-green-700 text-sm">⠿</span>
          <span className="text-xs font-semibold text-green-700 dark:text-green-400 flex-1">
            Drag {selectedCount} selected spec{selectedCount !== 1 ? 's' : ''}
          </span>
          <button
            onClick={e => { e.stopPropagation(); clearSelection(); }}
            className="text-xs text-green-500 hover:text-red-500 px-1"
            title="Clear selection"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hint when no selection */}
      {selectedCount === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-2 pb-1">
          Click spec to select · Ctrl+click multi · Shift+click range · drag to cell
        </p>
      )}

      {/* Spec list */}
      {specs.map((spec, specIdx) => {
        const specId = spec.id ?? `spec_${specIdx}`;
        const isExpanded = expandedSpecs.has(specId);
        const isSelected = selectedSpecIds.has(specId);

        return (
          <div key={specId}>
            <div className={`flex items-center gap-1 rounded ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-1 ring-indigo-400' : ''}`}>
              {/* Expand/collapse chevron */}
              <button
                onClick={e => { e.stopPropagation(); toggleExpand(specId); }}
                className="p-0.5 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Spec name — clickable for selection, draggable for single spec */}
              <div
                className="flex-1 min-w-0"
                onClick={e => handleSpecClick(e, specId, specIdx, specs)}
              >
                <SpecDragNode
                  sourceId={source.id}
                  specName={spec.name}
                  specIndex={specIdx}
                  isSelected={isSelected}
                  selectedSpecNames={selectedCount > 1 && isSelected
                    ? specs.filter((s, i) => selectedSpecIds.has(s.id ?? `spec_${i}`)).map(s => s.name)
                    : undefined}
                />
                {spec.applicability && Object.keys(spec.applicability).length > 0 && (
                  <div className="px-2 pb-1">
                    <ApplicabilityChips applicability={spec.applicability} variant="browser" />
                  </div>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="ml-2 border-l-2 border-gray-100 dark:border-gray-700 pl-1 space-y-0.5">
                {spec.requirements && spec.requirements.length > 0 ? (
                  spec.requirements.map((req, reqIdx) => (
                    <RequirementDragNode
                      key={req.key ?? reqIdx}
                      sourceId={source.id}
                      specName={spec.name}
                      requirement={req}
                      requirementIndex={reqIdx}
                    />
                  ))
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-1 ml-4">No requirements</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
