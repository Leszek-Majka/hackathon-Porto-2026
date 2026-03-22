import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { ValidationRun, SpecResult } from '../types/validation';

interface Props {
  run: ValidationRun;
}

function PassRing({ passRate }: { passRate: number }) {
  const pct = Math.round(passRate * 100);
  const data = [
    { name: 'pass', value: pct },
    { name: 'fail', value: 100 - pct },
  ];
  return (
    <div className="flex items-center gap-6">
      <div className="w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={38} outerRadius={52} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
              <Cell fill={pct >= 90 ? '#2E7D32' : pct >= 60 ? '#E65100' : '#B71C1C'} />
              <Cell fill="#E5E7EB" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className={`text-4xl font-bold ${pct >= 90 ? 'text-green-700' : pct >= 60 ? 'text-amber-600' : 'text-red-700'}`}>
          {pct}%
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pass Rate</div>
      </div>
    </div>
  );
}

export default function ValidationResults({ run }: Props) {
  const [expandedSpec, setExpandedSpec] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const summary = run.summary;
  const specs: SpecResult[] = run.results?.specs ?? [];

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <PassRing passRate={summary?.pass_rate ?? 0} />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.total_elements ?? 0}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Elements</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{summary?.passing_elements ?? 0}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Passing</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">{summary?.failing_elements ?? 0}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Failing</div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-spec accordion */}
      <div className="space-y-2">
        {specs.map(spec => (
          <div key={spec.spec_id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSpec(expandedSpec === spec.spec_id ? null : spec.spec_id)}
              className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-left"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${spec.failures.length === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-medium text-sm text-gray-900 dark:text-white">{spec.spec_name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {spec.failures.length === 0 ? (
                  <span className="text-green-600 dark:text-green-400">{spec.elements_passing} passed</span>
                ) : (
                  <>
                    <span className="text-green-600 dark:text-green-400">{spec.elements_passing} passed</span>
                    <span className="text-red-600 dark:text-red-400">{spec.failures.length} failed</span>
                  </>
                )}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${expandedSpec === spec.spec_id ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expandedSpec === spec.spec_id && (
              <div className="overflow-x-auto">
                {spec.failures.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    All {spec.elements_passing} elements passed
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">ID</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Type</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Name</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Failed Requirements</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {spec.failures.map((f, i) => (
                        <tr key={i} className="hover:bg-red-50 dark:hover:bg-red-900/10">
                          <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{f.element_id}</td>
                          <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300">{f.element_type}</td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{f.element_name || '—'}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {f.failed_requirements.map((r, j) => (
                                <span key={j} className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded font-mono">
                                  {r}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
