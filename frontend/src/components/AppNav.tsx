import React from 'react';

type AppTab = 'setup' | 'sources' | 'matrix' | 'export';

interface Props {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  projectName: string;
}

const TABS: { id: AppTab; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'sources', label: 'IDS Sources' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'export', label: 'Export' },
];

export default function AppNav({ activeTab, onTabChange, projectName }: Props) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-8 pt-5 pb-0">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded">
          {projectName}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">
          IDS Matrix Builder
        </span>
      </div>
      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
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
  );
}
