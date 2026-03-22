import React from 'react';
import { useDashboard } from '../hooks/useDashboard';
import MetricCards from './MetricCards';
import MaturityChart from './MaturityChart';
import ValidationProgressChart from './ValidationProgressChart';
import SpecHeatmap from './SpecHeatmap';
import { api } from '../api/client';

interface Props {
  projectId: number;
  phases: import('../types/project').Phase[];
}

export default function Dashboard({ projectId, phases }: Props) {
  const { data, loading, error, refresh } = useDashboard(projectId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-red-500">{error || 'Failed to load dashboard'}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <MetricCards metrics={data.metric_cards} />

      {/* PDF export button */}
      <div className="flex justify-end">
        <a
          href={api.dashboard.reportUrl(projectId)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Export PDF Report
        </a>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Maturity chart 60% */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Requirements Growth by Phase</h3>
          <MaturityChart data={data.maturity_chart} />
        </div>

        {/* Heatmap 40% */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Validation Heatmap</h3>
          <SpecHeatmap rows={data.heatmap} />
        </div>
      </div>

      {/* Validation progress chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Validation Progress Over Time</h3>
        <ValidationProgressChart series={data.validation_progress} />
      </div>
    </div>
  );
}
