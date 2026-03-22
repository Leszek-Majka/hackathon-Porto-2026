import React, { useState } from 'react';
import type { CellEntry } from '../types/matrix';
import EntryRow from './EntryRow';

interface Props {
  specName: string;
  groupKey: string;
  entries: CellEntry[];
  onStatusChange: (eid: number, status: string) => Promise<void>;
  onDeleteEntry: (eid: number) => Promise<void>;
  onDeleteGroup: (gkey: string) => Promise<void>;
}

export default function EntryGroup({ specName, groupKey, entries, onStatusChange, onDeleteEntry, onDeleteGroup }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-1 truncate">{specName}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {entries.length} req{entries.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => onDeleteGroup(groupKey)}
          className="p-0.5 text-gray-400 hover:text-red-500 transition-colors rounded"
          title="Remove group"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Entries */}
      {!collapsed && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map(entry => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onStatusChange={onStatusChange}
              onDelete={onDeleteEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
