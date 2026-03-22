import React from 'react';
import type { IDSSpecification } from '../types/ids';
import type { Phase, MatrixData, MatrixStatus } from '../types/project';

interface Props {
  specs: IDSSpecification[];
  phases: Phase[];
  matrixData: MatrixData | null;
}

function countStatus(
  specs: IDSSpecification[],
  phaseId: number,
  matrixData: MatrixData | null
): { required: number; optional: number; excluded: number; total: number } {
  let required = 0, optional = 0, excluded = 0;
  for (const spec of specs) {
    for (const req of spec.requirements) {
      const override = matrixData?.matrix?.[spec.id]?.[req.key]?.[String(phaseId)] as MatrixStatus | undefined;
      const status = override ?? req.baseStatus;
      if (status === 'required') required++;
      else if (status === 'optional') optional++;
      else excluded++;
    }
  }
  return { required, optional, excluded, total: required + optional + excluded };
}

interface SpecBreakdown {
  spec: IDSSpecification;
  required: number;
  optional: number;
  excluded: number;
}

function specBreakdown(
  specs: IDSSpecification[],
  phaseId: number,
  matrixData: MatrixData | null
): SpecBreakdown[] {
  return specs.map(spec => {
    let required = 0, optional = 0, excluded = 0;
    for (const req of spec.requirements) {
      const override = matrixData?.matrix?.[spec.id]?.[req.key]?.[String(phaseId)] as MatrixStatus | undefined;
      const status = override ?? req.baseStatus;
      if (status === 'required') required++;
      else if (status === 'optional') optional++;
      else excluded++;
    }
    return { spec, required, optional, excluded };
  });
}

export default function CompareView({ specs, phases, matrixData }: Props) {
  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);

  if (sortedPhases.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
        Add phases to see the comparison view.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {sortedPhases.map(phase => {
        const totals = countStatus(specs, phase.id, matrixData);
        const breakdown = specBreakdown(specs, phase.id, matrixData);

        return (
          <div
            key={phase.id}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
          >
            {/* Phase header */}
            <div
              className="px-5 py-4 border-b border-gray-100 dark:border-gray-800"
              style={{ borderLeftColor: phase.color, borderLeftWidth: 4 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: phase.color }} />
                <h3 className="font-semibold text-gray-900 dark:text-white">{phase.name}</h3>
              </div>
              <div className="mt-3 flex gap-3 text-sm">
                <div className="flex-1 text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="text-xl font-bold text-green-700 dark:text-green-400">{totals.required}</div>
                  <div className="text-xs text-green-600 dark:text-green-500 mt-0.5">Required</div>
                </div>
                <div className="flex-1 text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{totals.optional}</div>
                  <div className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Optional</div>
                </div>
                <div className="flex-1 text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="text-xl font-bold text-gray-500 dark:text-gray-400">{totals.excluded}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Excluded</div>
                </div>
              </div>
            </div>

            {/* Per-spec breakdown */}
            <div className="px-5 py-3 space-y-2.5">
              {breakdown.map(({ spec, required, optional, excluded }) => (
                <div key={spec.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate" title={spec.name}>
                      {spec.name}
                    </span>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      {required + optional + excluded} reqs
                    </span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden gap-px">
                    {required > 0 && (
                      <div
                        className="bg-green-400 dark:bg-green-600 rounded-l-full"
                        style={{ flex: required }}
                        title={`${required} required`}
                      />
                    )}
                    {optional > 0 && (
                      <div
                        className="bg-amber-400 dark:bg-amber-500"
                        style={{ flex: optional }}
                        title={`${optional} optional`}
                      />
                    )}
                    {excluded > 0 && (
                      <div
                        className="bg-gray-200 dark:bg-gray-700 rounded-r-full"
                        style={{ flex: excluded }}
                        title={`${excluded} excluded`}
                      />
                    )}
                    {required + optional + excluded === 0 && (
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full" />
                    )}
                  </div>
                  <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
                    {required > 0 && <span className="text-green-600 dark:text-green-500">{required} REQ</span>}
                    {optional > 0 && <span className="text-amber-600 dark:text-amber-500">{optional} OPT</span>}
                    {excluded > 0 && <span>{excluded} EXC</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
