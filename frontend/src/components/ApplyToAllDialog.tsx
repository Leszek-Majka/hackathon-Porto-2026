import React from 'react';

interface Props {
  disciplineName: string;
  onThisPhaseOnly: () => void;
  onAllPhases: () => void;
  onCancel: () => void;
}

export default function ApplyToAllDialog({ disciplineName, onThisPhaseOnly, onAllPhases, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Apply to phases</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Apply this specification to only this phase, or to all phases in the{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-300">{disciplineName}</span> discipline?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onAllPhases}
            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            All phases in {disciplineName}
          </button>
          <button
            onClick={onThisPhaseOnly}
            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            This phase only
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
