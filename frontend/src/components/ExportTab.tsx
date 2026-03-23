import React from 'react';
import { api } from '../api/client';
import type { Discipline } from '../types/setup';
import type { Phase } from '../types/project';

interface Props {
  projectId: number;
  disciplines: Discipline[];
  phases: Phase[];
}

function DownloadLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      download
      className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </a>
  );
}

export default function ExportTab({ projectId, disciplines, phases }: Props) {
  if (disciplines.length === 0 || phases.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Add disciplines and phases first to enable export.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white mb-1">IDS Export</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Download IDS files for individual cells, by discipline, by phase, or the complete matrix.
        </p>
      </div>

      {/* Export all */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Full Matrix Export</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Downloads a ZIP archive with one IDS file per discipline/phase combination, organised in folders.
        </p>
        <DownloadLink
          url={api.export.allUrl(projectId)}
          label="Download all as ZIP"
        />
      </div>

      {/* By discipline */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By Discipline</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Download a ZIP with all phases for a single discipline.
        </p>
        <div className="flex flex-wrap gap-2">
          {disciplines.map(d => (
            <a
              key={d.id}
              href={api.export.disciplineUrl(projectId, d.id)}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: d.color }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {d.name}
            </a>
          ))}
        </div>
      </div>

      {/* By phase */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By Phase</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Download a ZIP with all disciplines for a single phase.
        </p>
        <div className="flex flex-wrap gap-2">
          {phases.map(p => (
            <a
              key={p.id}
              href={api.export.phaseUrl(projectId, p.id)}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: p.color }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {p.name}
            </a>
          ))}
        </div>
      </div>

      {/* Per cell */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Per Cell</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Download individual IDS files for specific discipline/phase combinations.
        </p>
        <div className="overflow-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium border-r border-b border-gray-200 dark:border-gray-700">
                  Discipline
                </th>
                {phases.map(p => (
                  <th key={p.id} className="px-3 py-2 text-center border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: p.color }}>
                      {p.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {disciplines.map(d => (
                <tr key={d.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="font-medium text-gray-700 dark:text-gray-300">{d.name}</span>
                    </div>
                  </td>
                  {phases.map(p => (
                    <td key={p.id} className="px-3 py-2 text-center">
                      <a
                        href={api.export.cellUrl(projectId, d.id, p.id)}
                        download
                        className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                      >
                        .ids
                      </a>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
