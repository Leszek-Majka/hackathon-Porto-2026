import React from 'react';
import type { CellEntry } from '../types/matrix';
import StatusPill from './StatusPill';

interface Props {
  entry: CellEntry;
  onStatusChange: (eid: number, status: string) => Promise<void>;
  onDelete: (eid: number) => Promise<void>;
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

function reqLabel(req: any): string {
  if (!req) return '—';
  if (req.type === 'attribute') return req.name?.value ?? 'Attribute';
  if (req.type === 'property') {
    const ps = req.propertySet?.value ?? '';
    const bn = req.baseName?.value ?? '';
    return ps && bn ? `${ps}.${bn}` : bn || ps || 'Property';
  }
  if (req.type === 'material') return 'Material';
  if (req.type === 'classification') return req.system?.value ?? 'Classification';
  return req.type ?? '?';
}

export default function EntryRow({ entry, onStatusChange, onDelete }: Props) {
  const req = entry.requirement;
  const reqType = req?.type ?? entry.entry_type;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 group hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded">
      <span className={`font-mono text-xs px-1 rounded flex-shrink-0 ${typeColor(reqType)}`}>
        {typeIcon(reqType)}
      </span>
      <span className="font-mono text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">
        {reqLabel(req)}
      </span>
      <StatusPill
        status={entry.status}
        onChange={async newStatus => {
          await onStatusChange(entry.id, newStatus);
        }}
      />
      <button
        onClick={() => onDelete(entry.id)}
        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all rounded"
        title="Remove entry"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
