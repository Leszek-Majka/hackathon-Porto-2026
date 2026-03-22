import React, { useState } from 'react';
import { api } from '../api/client';
import type { Phase } from '../types/project';

const LANGUAGES = [
  { code: 'en', label: '🇬🇧 English' },
  { code: 'pl', label: '🇵🇱 Polish' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'nl', label: '🇳🇱 Dutch' },
];

interface Props {
  projectId: number;
  phases: Phase[];
}

export default function ExportPanel({ projectId, phases }: Props) {
  const [phaseLangs, setPhaseLangs] = useState<Record<number, string>>({});
  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);

  if (sortedPhases.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Add phases before exporting.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {sortedPhases.map(phase => {
          const lang = phaseLangs[phase.id] ?? 'en';
          return (
            <div
              key={phase.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
              <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{phase.name}</span>
              <select
                value={lang}
                onChange={e => setPhaseLangs(prev => ({ ...prev, [phase.id]: e.target.value }))}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <a
                href={api.export.phaseUrl(projectId, phase.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export .ids
              </a>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <a
          href={api.export.allUrl(projectId)}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export All Phases as ZIP
        </a>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
          ZIP exports all phases in English
        </p>
      </div>
    </div>
  );
}
