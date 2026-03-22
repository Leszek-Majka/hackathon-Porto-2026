import React from 'react';
import { Link } from 'react-router-dom';

type AppTab = 'setup' | 'sources' | 'matrix' | 'export';

interface Props {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  projectName: string;
  projectDescription?: string;
}

const TABS: { id: AppTab; label: string }[] = [
  { id: 'setup',   label: 'Setup' },
  { id: 'sources', label: 'IDS Sources' },
  { id: 'matrix',  label: 'Matrix' },
  { id: 'export',  label: 'Export' },
];

export default function AppNav({ activeTab, onTabChange, projectName, projectDescription }: Props) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6">
      <div className="flex items-end gap-0 h-11">

        {/* Left: back + project info */}
        <div className="flex items-center gap-3 mr-6 pb-2.5 flex-shrink-0 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Projects
          </Link>
          <span className="text-gray-200 dark:text-gray-700 flex-shrink-0">/</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-xs">
            {projectName}
          </span>
          {projectDescription && (
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs hidden lg:block">
              — {projectDescription}
            </span>
          )}
        </div>

        {/* Right: tabs */}
        <div className="flex gap-0.5 flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
