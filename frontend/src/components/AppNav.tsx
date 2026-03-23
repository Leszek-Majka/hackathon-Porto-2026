import React from 'react';
import { Link } from 'react-router-dom';

export type AppTab = 'setup' | 'sources' | 'matrix' | 'compare' | 'validate' | 'export';

interface Props {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  projectName: string;
  projectDescription?: string;
}

type IconProps = {
  className?: string;
};

function SetupIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h10M4 17h6M16 7h4M12 17h8" />
      <circle cx="12" cy="7" r="2.5" strokeWidth={1.8} />
      <circle cx="9" cy="17" r="2.5" strokeWidth={1.8} />
    </svg>
  );
}

function ImportIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v10m0 0l-4-4m4 4l4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
    </svg>
  );
}

function MatrixIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="4" y="4" width="6" height="6" rx="1.5" strokeWidth={1.8} />
      <rect x="14" y="4" width="6" height="6" rx="1.5" strokeWidth={1.8} />
      <rect x="4" y="14" width="6" height="6" rx="1.5" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 14v6m0 0l-2.5-2.5M17 20l2.5-2.5" />
    </svg>
  );
}

function CompareIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 5H5v14h3M16 5h3v14h-3" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 8l4 4-4 4M14 8l-4 4 4 4" />
    </svg>
  );
}

function ExportIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 21V11m0 10l-4-4m4 4l4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 9V6a2 2 0 012-2h10a2 2 0 012 2v3" />
    </svg>
  );
}

function ValidateIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4" />
    </svg>
  );
}

const PRIMARY_TABS: {
  id: Exclude<AppTab, 'validate'>;
  label: string;
  title: string;
  Icon: (props: IconProps) => JSX.Element;
}[] = [
  { id: 'setup', label: 'Project Setup', title: 'Project phases and disciplines', Icon: SetupIcon },
  { id: 'sources', label: 'IDS Import', title: 'Upload IDS source files', Icon: ImportIcon },
  { id: 'matrix', label: 'IDS Split/Merge', title: 'Assign and split requirements', Icon: MatrixIcon },
  { id: 'compare', label: 'IDS Compare', title: 'Compare sources and cells', Icon: CompareIcon },
  { id: 'export', label: 'IDS Export', title: 'Generate IDS outputs', Icon: ExportIcon },
];

export default function AppNav({ activeTab, onTabChange, projectName, projectDescription }: Props) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-6 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0 max-w-[420px] flex-shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-xs uppercase tracking-[0.18em]">Projects</span>
            </Link>
            <span className="text-gray-300 dark:text-gray-700 flex-shrink-0">|</span>
            <span className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white">{projectName}</span>
            {projectDescription && (
              <>
                <span className="text-gray-300 dark:text-gray-700 flex-shrink-0">|</span>
                <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">{projectDescription}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-2 w-max pr-2">
            {PRIMARY_TABS.map(({ id, label, title, Icon }) => (
              <button
                key={id}
                type="button"
                title={title}
                onClick={() => onTabChange(id)}
                className={`inline-flex items-center gap-3 rounded-xl border px-6 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          title="Validate IFC models against the IDS matrix"
          onClick={() => onTabChange('validate')}
          className={`inline-flex items-center justify-center gap-3 flex-shrink-0 rounded-xl border px-6 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'validate'
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
          }`}
        >
          <ValidateIcon className="w-5 h-5 flex-shrink-0" />
          <span>IFC Validation</span>
        </button>
      </div>
    </div>
  );
}
