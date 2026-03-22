import React, { useState } from 'react';
import type { IDSSource } from '../types/sources';
import IDSTreeBrowser from './IDSTreeBrowser';

interface Props {
  source: IDSSource;
  projectId: number;
  onRemove: (id: number) => void;
}

export default function IDSSourceCard({ source, projectId, onRemove }: Props) {
  const [inspecting, setInspecting] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!confirm(`Remove source "${source.filename}"? Any references in the matrix will become orphaned.`)) return;
    setRemoving(true);
    try {
      onRemove(source.id);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Icon */}
        <div className="w-8 h-8 flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">{source.filename}</p>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{source.title || 'Untitled'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {source.author && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{source.author}</span>
            )}
            {source.version && (
              <span className="text-xs text-gray-400 dark:text-gray-500">v{source.version}</span>
            )}
            <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
              {source.spec_count} spec{source.spec_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInspecting(!inspecting)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              inspecting
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {inspecting ? 'Close' : 'Inspect'}
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-red-500 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Tree browser */}
      {inspecting && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 max-h-80 overflow-y-auto">
          <IDSTreeBrowser source={source} projectId={projectId} />
        </div>
      )}
    </div>
  );
}
