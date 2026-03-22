import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { IDSSource, IDSParsed, IDSSpec } from '../types/sources';
import { SpecDragNode, RequirementDragNode } from './IDSTreeNode';

interface Props {
  source: IDSSource;
  projectId: number;
}

export default function IDSTreeBrowser({ source, projectId }: Props) {
  const [parsed, setParsed] = useState<IDSParsed | null>(source.parsed ?? null);
  const [loading, setLoading] = useState(!source.parsed);
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!parsed) {
      setLoading(true);
      api.sources.get(projectId, source.id)
        .then(s => setParsed(s.parsed ?? null))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [source.id, projectId]);

  function toggleSpec(specId: string) {
    setExpandedSpecs(prev => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!parsed || !parsed.specifications?.length) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 py-3 px-2">No specifications found.</p>;
  }

  return (
    <div className="space-y-0.5">
      {parsed.specifications.map((spec, specIdx) => {
        const specId = spec.id ?? `spec_${specIdx}`;
        const isExpanded = expandedSpecs.has(specId);
        return (
          <div key={specId}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleSpec(specId)}
                className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <SpecDragNode sourceId={source.id} specName={spec.name} specIndex={specIdx} />
            </div>
            {isExpanded && (
              <div className="ml-2 border-l-2 border-gray-100 dark:border-gray-700 pl-1 space-y-0.5">
                {spec.requirements && spec.requirements.length > 0 ? (
                  spec.requirements.map((req, reqIdx) => (
                    <RequirementDragNode
                      key={req.key ?? reqIdx}
                      sourceId={source.id}
                      specName={spec.name}
                      requirement={req}
                      requirementIndex={reqIdx}
                    />
                  ))
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-1 ml-4">No requirements</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
