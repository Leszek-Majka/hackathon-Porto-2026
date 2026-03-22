import React, { useState } from 'react';
import type { IDSSpecification } from '../types/ids';
import type { Phase, MatrixData, MatrixStatus } from '../types/project';
import StatusSelector from './StatusSelector';

interface Props {
  specs: IDSSpecification[];
  phases: Phase[];
  matrixData: MatrixData | null;
  saving: Set<string>;
  onCellChange: (specId: string, reqKey: string, phaseId: number, status: MatrixStatus) => void;
}

function getStatus(
  matrixData: MatrixData | null,
  specId: string,
  reqKey: string,
  phaseId: number,
  baseStatus: 'required' | 'optional'
): MatrixStatus {
  const override = matrixData?.matrix?.[specId]?.[reqKey]?.[String(phaseId)];
  return (override as MatrixStatus) ?? baseStatus;
}

function reqLabel(req: import('../types/ids').IDSRequirement): string {
  if (req.type === 'attribute' && req.name) {
    return req.name.value ?? req.key;
  }
  if (req.type === 'property') {
    const ps = req.propertySet?.value ?? '?';
    const bn = req.baseName?.value ?? '?';
    return `${ps}.${bn}`;
  }
  if (req.type === 'classification' && req.system) {
    return `Classification: ${req.system.value ?? '?'}`;
  }
  if (req.type === 'partOf') {
    return `PartOf: ${req.relation ?? '?'}`;
  }
  if (req.type === 'material') {
    return 'Material';
  }
  return req.key;
}

export default function SpecMatrix({ specs, phases, matrixData, saving, onCellChange }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(specId: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  }

  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);

  if (specs.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
        No specifications found in IDS file.
      </p>
    );
  }

  if (sortedPhases.length === 0) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400 text-center py-10">
        Add at least one phase to start editing the matrix.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {specs.map(spec => (
        <div
          key={spec.id}
          className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
        >
          {/* Spec header */}
          <button
            onClick={() => toggleCollapse(spec.id)}
            className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors text-left"
          >
            <div>
              <span className="font-semibold text-gray-900 dark:text-white text-sm">{spec.name}</span>
              {spec.ifcVersion && (
                <span className="ml-2 text-xs font-mono text-gray-400 dark:text-gray-500">{spec.ifcVersion}</span>
              )}
              <span className="ml-3 text-xs text-gray-500 dark:text-gray-400">
                {spec.requirements.length} requirement{spec.requirements.length !== 1 ? 's' : ''}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${collapsed.has(spec.id) ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {!collapsed.has(spec.id) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-white dark:bg-gray-900 w-64">
                      Requirement
                    </th>
                    <th className="px-3 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-white dark:bg-gray-900 w-16">
                      Base
                    </th>
                    {sortedPhases.map(phase => (
                      <th
                        key={phase.id}
                        className="px-3 py-2.5 text-xs font-medium uppercase tracking-wider bg-white dark:bg-gray-900 text-center min-w-[80px]"
                        style={{ color: phase.color }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: phase.color }} />
                          {phase.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {spec.requirements.map(req => (
                    <tr
                      key={req.key}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300 max-w-[16rem] truncate" title={reqLabel(req)}>
                        <span className="text-gray-400 dark:text-gray-600 mr-1.5">{req.type.charAt(0).toUpperCase()}</span>
                        {reqLabel(req)}
                        {req.instructions && (
                          <span className="ml-2 text-gray-400 dark:text-gray-600 font-sans not-italic" title={req.instructions}>
                            ℹ️
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                            req.baseStatus === 'required'
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {req.baseStatus === 'required' ? 'REQ' : 'OPT'}
                        </span>
                      </td>
                      {sortedPhases.map(phase => {
                        const cellKey = `${spec.id}|${req.key}|${phase.id}`;
                        const status = getStatus(matrixData, spec.id, req.key, phase.id, req.baseStatus);
                        return (
                          <td key={phase.id} className="px-3 py-2 text-center">
                            <div className="flex justify-center items-center">
                              {saving.has(cellKey) ? (
                                <div className="w-14 h-7 flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                                </div>
                              ) : (
                                <StatusSelector
                                  value={status}
                                  onChange={s => onCellChange(spec.id, req.key, phase.id, s)}
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
