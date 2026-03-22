import React from 'react';
import PhaseManager from './PhaseManager';
import DisciplineManager from './DisciplineManager';
import MatrixPreview from './MatrixPreview';
import type { Discipline } from '../types/setup';
import type { Phase } from '../types/project';

interface Props {
  projectId: number;
  phases: Phase[];
  disciplines: Discipline[];
  onChanged: () => void;
}

export default function SetupTab({ projectId, phases, disciplines, onChanged }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white mb-1">Project Setup</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Define the phases and disciplines that form the axes of your matrix.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phases */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Phases</h3>
          <PhaseManager projectId={projectId} phases={phases} onChanged={onChanged} />
        </div>

        {/* Disciplines */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <DisciplineManager projectId={projectId} disciplines={disciplines} onChanged={onChanged} />
        </div>
      </div>

      <MatrixPreview phases={phases} disciplines={disciplines} />
    </div>
  );
}
