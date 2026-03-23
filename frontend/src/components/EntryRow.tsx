import React, { useState } from 'react';
import type { CellEntry } from '../types/matrix';
import StatusPill from './StatusPill';

interface Props {
  entry: CellEntry;
  onStatusChange: (eid: number, status: string) => Promise<void>;
  onDelete: (eid: number) => Promise<void>;
  onUpdateValues?: (eid: number, values: string[]) => Promise<void>;
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
  if (req.type === 'partOf') return req.entity?.name?.value ? `partOf ${req.entity.name.value}` : 'Part Of';
  if (req.type === 'entity') return req.name?.value ?? 'Entity';
  return req.type ?? '?';
}

function getEnumValues(req: any): string[] | null {
  const v = req?.value;
  if (!v) return null;
  if (v.type === 'enumeration') return v.values ?? [];
  if (v.type === 'simpleValue' && v.value) return [v.value];
  return null;
}

export default function EntryRow({ entry, onStatusChange, onDelete, onUpdateValues }: Props) {
  const [enumOpen, setEnumOpen] = useState(false);
  const req = entry.requirement;
  const reqType = req?.type ?? entry.entry_type;
  const enumValues = getEnumValues(req);
  const hasEnum = enumValues && enumValues.length > 0;
  const isMultiEnum = enumValues && enumValues.length > 1;

  return (
    <div>
      {/* Main row */}
      <div className="flex items-center gap-2 py-1.5 px-2 group hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded">
        {/* Chevron for enum */}
        {hasEnum ? (
          <button
            onClick={() => setEnumOpen(v => !v)}
            className="flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
            title={enumOpen ? 'Collapse values' : 'Show values'}
          >
            <svg
              className={`w-3 h-3 transition-transform ${enumOpen ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        <span className={`font-mono text-xs px-1 rounded flex-shrink-0 ${typeColor(reqType)}`}>
          {typeIcon(reqType)}
        </span>

        <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
          {reqLabel(req)}
        </span>

        {/* Value hint */}
        {isMultiEnum && (
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500 flex-shrink-0">
            {enumValues!.length}×
          </span>
        )}
        {!isMultiEnum && enumValues?.length === 1 && (
          <span className="text-xs font-mono text-indigo-500 dark:text-indigo-400 flex-shrink-0 max-w-[100px] truncate" title={enumValues[0]}>
            = {enumValues[0]}
          </span>
        )}

        <StatusPill
          status={entry.status}
          onChange={async newStatus => { await onStatusChange(entry.id, newStatus); }}
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

      {/* Enum values expanded */}
      {hasEnum && enumOpen && (
        <div className="ml-8 mb-1 border-l border-blue-100 dark:border-blue-900/40 pl-2 flex flex-wrap gap-1">
          {enumValues!.map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-0.5 font-mono text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
            >
              {v}
              {onUpdateValues && (
                <button
                  onClick={() => onUpdateValues(entry.id, enumValues!.filter(x => x !== v))}
                  className="ml-0.5 text-blue-300 hover:text-red-500 dark:text-blue-600 dark:hover:text-red-400 transition-colors leading-none"
                  title={`Remove "${v}"`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
