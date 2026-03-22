import React from 'react';
import { api } from '../api/client';
import type { Phase } from '../types/project';

interface Props {
  projectId: number;
  phases: Phase[];
}

function downloadUrl(url: string, filename?: string) {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function ExportPanel({ projectId, phases }: Props) {
  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);

  if (sortedPhases.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Add phases before exporting.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {sortedPhases.map(phase => (
          <div
            key={phase.id}
            className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: phase.color }} />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{phase.name}</span>
            </div>
            <a
              href={api.export.phase(projectId, phase.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export .ids
            </a>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <a
          href={api.export.all(projectId)}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export All Phases as ZIP
        </a>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
          Downloads a ZIP archive with one .ids file per phase
        </p>
      </div>
    </div>
  );
}
