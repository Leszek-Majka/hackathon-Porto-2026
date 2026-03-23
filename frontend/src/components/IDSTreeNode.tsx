import React, { useState } from 'react';
import { useDragContext } from '../dnd/DragContext';
import type { IDSRequirement } from '../types/sources';
import type { DropPayload } from '../types/matrix';

interface SpecNodeProps {
  sourceId: number;
  specName: string;
  specIndex: number;
  isSelected?: boolean;
  /** When set, dragging this node sends a multi_specification payload instead */
  selectedSpecNames?: string[];
}

interface ReqNodeProps {
  sourceId: number;
  specName: string;
  requirement: IDSRequirement;
  requirementIndex: number;
}

export function reqLabel(req: IDSRequirement): string {
  if (req.type === 'attribute') return req.name?.value ?? 'Attribute';
  if (req.type === 'property') {
    const ps = req.propertySet?.value ?? '';
    const bn = req.baseName?.value ?? '';
    return ps && bn ? `${ps}.${bn}` : bn || ps || 'Property';
  }
  if (req.type === 'material') return 'Material';
  if (req.type === 'classification') return req.system?.value ?? 'Classification';
  if (req.type === 'partOf') return (req as any).entity?.name?.value ? `partOf ${(req as any).entity.name.value}` : 'Part Of';
  if (req.type === 'entity') return (req as any).name?.value ?? 'Entity';
  return req.type;
}

function typeIcon(type: string): string {
  switch (type) {
    case 'property': return 'P';
    case 'attribute': return 'A';
    case 'material': return 'M';
    case 'classification': return 'C';
    case 'partOf': return 'PO';
    case 'entity': return 'E';
    default: return '?';
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'property': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'attribute': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'material': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'classification': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'partOf': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    case 'entity': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
}

export function SpecDragNode({ sourceId, specName, specIndex, isSelected, selectedSpecNames }: SpecNodeProps) {
  const { setDragging } = useDragContext();

  const isMulti = selectedSpecNames && selectedSpecNames.length > 1;

  const payload: DropPayload = isMulti
    ? {
        sourceIdsId: sourceId,
        dropType: 'multi_specification',
        specName: '',
        specNames: selectedSpecNames,
        applicabilityIndex: null,
        requirementIndex: null,
      }
    : {
        sourceIdsId: sourceId,
        dropType: 'specification',
        specName,
        applicabilityIndex: null,
        requirementIndex: null,
      };

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
        setDragging(payload);
      }}
      onDragEnd={() => setDragging(null)}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing select-none transition-colors ${
        isSelected
          ? 'hover:bg-indigo-200/60 dark:hover:bg-indigo-800/40'
          : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
      }`}
    >
      <span className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors text-sm flex-shrink-0">⠿</span>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{specName}</span>
      {isMulti ? (
        <span className="ml-auto text-xs text-green-600 dark:text-green-400 flex-shrink-0">
          +{selectedSpecNames!.length - 1} more
        </span>
      ) : (
        <span className="ml-auto text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          drag
        </span>
      )}
    </div>
  );
}

export function RequirementDragNode({ sourceId, specName, requirement, requirementIndex }: ReqNodeProps) {
  const { setDragging } = useDragContext();
  const [expanded, setExpanded] = useState(false);

  const enumValues: string[] = requirement.value?.type === 'enumeration'
    ? (requirement.value.values ?? [])
    : [];
  const hasEnum = enumValues.length > 0;

  const basePayload: DropPayload = {
    sourceIdsId: sourceId,
    dropType: 'requirement',
    specName,
    applicabilityIndex: null,
    requirementIndex,
  };

  return (
    <div className="ml-4">
      {/* Main requirement row */}
      <div
        draggable
        onDragStart={e => {
          e.dataTransfer.setData('application/json', JSON.stringify(basePayload));
          e.dataTransfer.effectAllowed = 'copy';
          setDragging(basePayload);
        }}
        onDragEnd={() => setDragging(null)}
        className="group flex items-center gap-1.5 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-grab active:cursor-grabbing select-none"
      >
        {/* Chevron — only when has enum values */}
        {hasEnum ? (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); e.preventDefault(); setExpanded(v => !v); }}
            className="flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors text-xs flex-shrink-0">⠿</span>
        <span className={`font-mono text-xs px-1 rounded flex-shrink-0 ${typeColor(requirement.type)}`}>
          {typeIcon(requirement.type)}
        </span>
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
          {reqLabel(requirement)}
        </span>
        {hasEnum && (
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 font-mono">
            {enumValues.length}×
          </span>
        )}
        <span className={`ml-auto text-xs flex-shrink-0 ${requirement.baseStatus === 'required' ? 'text-green-600 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'}`}>
          {requirement.baseStatus === 'required' ? 'req' : 'opt'}
        </span>
      </div>

      {/* Enum values sub-list */}
      {hasEnum && expanded && (
        <div className="ml-6 border-l border-blue-100 dark:border-blue-900/40 pl-2 space-y-0.5 pb-1">
          {enumValues.map(val => {
            const valPayload: DropPayload = { ...basePayload, valueOverride: val };
            return (
              <div
                key={val}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/json', JSON.stringify(valPayload));
                  e.dataTransfer.effectAllowed = 'copy';
                  setDragging(valPayload);
                }}
                onDragEnd={() => setDragging(null)}
                className="group flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-grab active:cursor-grabbing select-none"
              >
                <span className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 text-xs flex-shrink-0">⠿</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">{val}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
