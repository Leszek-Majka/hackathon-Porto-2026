import React from 'react';
import { useDragContext } from '../dnd/DragContext';
import type { IDSRequirement } from '../types/sources';
import type { DropPayload } from '../types/matrix';

interface SpecNodeProps {
  sourceId: number;
  specName: string;
  specIndex: number;
}

interface ReqNodeProps {
  sourceId: number;
  specName: string;
  requirement: IDSRequirement;
  requirementIndex: number;
}

function reqLabel(req: IDSRequirement): string {
  if (req.type === 'attribute') return req.name?.value ?? 'Attribute';
  if (req.type === 'property') {
    const ps = req.propertySet?.value ?? '';
    const bn = req.baseName?.value ?? '';
    return ps && bn ? `${ps}.${bn}` : bn || ps || 'Property';
  }
  if (req.type === 'material') return 'Material';
  if (req.type === 'classification') return req.system?.value ?? 'Classification';
  return req.type;
}

function typeIcon(type: string): string {
  switch (type) {
    case 'property': return 'P';
    case 'attribute': return 'A';
    case 'material': return 'M';
    case 'classification': return 'C';
    default: return '?';
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'property': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'attribute': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'material': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'classification': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
}

export function SpecDragNode({ sourceId, specName, specIndex }: SpecNodeProps) {
  const { setDragging } = useDragContext();

  const payload: DropPayload = {
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
      className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-grab active:cursor-grabbing select-none"
    >
      <span className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors text-sm">⠿</span>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{specName}</span>
      <span className="ml-auto text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">drag spec</span>
    </div>
  );
}

export function RequirementDragNode({ sourceId, specName, requirement, requirementIndex }: ReqNodeProps) {
  const { setDragging } = useDragContext();

  const payload: DropPayload = {
    sourceIdsId: sourceId,
    dropType: 'requirement',
    specName,
    applicabilityIndex: null,
    requirementIndex,
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
      className="group flex items-center gap-2 px-2 py-1 ml-4 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-grab active:cursor-grabbing select-none"
    >
      <span className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors text-xs">⠿</span>
      <span className={`font-mono text-xs px-1 rounded ${typeColor(requirement.type)}`}>
        {typeIcon(requirement.type)}
      </span>
      <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate">
        {reqLabel(requirement)}
      </span>
      {requirement.baseStatus === 'required' ? (
        <span className="ml-auto text-xs text-green-600 dark:text-green-400">req</span>
      ) : (
        <span className="ml-auto text-xs text-amber-500 dark:text-amber-400">opt</span>
      )}
    </div>
  );
}
