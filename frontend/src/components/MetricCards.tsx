import React from 'react';
import type { MetricCards as MetricCardsType } from '../types/dashboard';

interface Props {
  metrics: MetricCardsType;
}

export default function MetricCards({ metrics }: Props) {
  const passRate = metrics.latest_pass_rate !== null ? Math.round(metrics.latest_pass_rate * 100) : null;

  const cards = [
    { label: 'Specifications', value: metrics.total_specs, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Requirements', value: metrics.total_requirements, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Phases', value: metrics.phases_defined, color: 'text-indigo-600 dark:text-indigo-400' },
    {
      label: 'Latest Pass Rate',
      value: passRate !== null ? `${passRate}%` : '—',
      color: passRate === null ? 'text-gray-400' : passRate >= 90 ? 'text-green-600 dark:text-green-400' : passRate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</div>
        </div>
      ))}
      {metrics.most_problematic_spec && (
        <div className="col-span-2 md:col-span-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="text-xs text-red-600 dark:text-red-400 font-medium uppercase tracking-wide mb-1">Most Problematic Specification</div>
          <div className="text-sm font-medium text-red-800 dark:text-red-300">{metrics.most_problematic_spec}</div>
        </div>
      )}
    </div>
  );
}
