import React, { useState, useEffect } from 'react';
import type { IDSSource } from '../types/sources';
import IDSTreeBrowser from './IDSTreeBrowser';

interface Props {
  projectId: number;
  sources: IDSSource[];
}

export default function IDSBrowserPanel({ projectId, sources }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

  useEffect(() => {
    if (sources.length > 0 && (selectedSourceId === null || !sources.find(s => s.id === selectedSourceId))) {
      setSelectedSourceId(sources[0].id);
    }
  }, [sources]);

  const selectedSource = sources.find(s => s.id === selectedSourceId) ?? null;

  if (sources.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No IDS sources uploaded yet.{' '}
          <span className="text-indigo-600 dark:text-indigo-400">Go to IDS Sources tab to add files.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden h-full flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">IDS Browser</span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Source selector */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <select
              value={selectedSourceId ?? ''}
              onChange={e => setSelectedSourceId(Number(e.target.value))}
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {sources.map(s => (
                <option key={s.id} value={s.id}>
                  {s.filename} ({s.spec_count} specs)
                </option>
              ))}
            </select>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {selectedSource ? (
              <>
                <p className="text-xs text-gray-400 dark:text-gray-500 px-2 pb-2">
                  Drag items onto matrix cells
                </p>
                <IDSTreeBrowser source={selectedSource} projectId={projectId} />
              </>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 p-2">Select a source above.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
