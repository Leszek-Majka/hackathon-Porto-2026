import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useSetup } from '../hooks/useSetup';
import { useSources } from '../hooks/useSources';
import { DragProvider } from '../dnd/DragContext';
import AppNav from './AppNav';
import SetupTab from './SetupTab';
import SourcesTab from './SourcesTab';
import MatrixTab from './MatrixTab';
import CompareTab from './CompareTab';
import ValidateTab from './ValidateTab';
import ExportTab from './ExportTab';
import LCADashboard from './lca/LCADashboard';
import LcaCostTab from './LcaCostTab';

type AppTab = 'setup' | 'sources' | 'matrix' | 'compare' | 'validate' | 'export' | 'lca' | 'lca-cost';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const { project, loading: projectLoading, error: projectError, refresh: refreshProject } = useProject(projectId);
  const { phases, disciplines, loading: setupLoading, refresh: refreshSetup } = useSetup(projectId);
  const { sources } = useSources(projectId);

  const [tab, setTab] = useState<AppTab>('setup');

  if (projectLoading || setupLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">{projectError || 'Project not found'}</p>
        <Link to="/" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  function handleSetupChanged() {
    refreshSetup();
    refreshProject();
  }

  return (
    <DragProvider>
      <div className="flex flex-col h-full">
        <AppNav
          activeTab={tab}
          onTabChange={setTab}
          projectName={project.name}
          projectDescription={project.description}
        />

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 flex flex-col min-h-0">
          {tab === 'setup' && (
            <SetupTab
              projectId={projectId}
              phases={phases}
              disciplines={disciplines}
              onChanged={handleSetupChanged}
            />
          )}

          {tab === 'sources' && (
            <SourcesTab projectId={projectId} />
          )}

          {tab === 'matrix' && (
            <MatrixTab
              projectId={projectId}
              disciplines={disciplines}
              phases={phases}
            />
          )}

          {tab === 'compare' && (
            <CompareTab
              projectId={projectId}
              disciplines={disciplines}
              phases={phases}
              idsSources={sources}
            />
          )}

          {tab === 'validate' && (
            <ValidateTab
              projectId={projectId}
              disciplines={disciplines}
              phases={phases}
            />
          )}

          {tab === 'export' && (
            <ExportTab
              projectId={projectId}
              disciplines={disciplines}
              phases={phases}
            />
          )}

          {tab === 'lca' && (
            <div>
              <div className="mb-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Carbon / LCA Dashboard</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  EN 15978 lifecycle carbon assessment with RIBA phase mapping.
                </p>
              </div>
              <LCADashboard projectId={projectId} phases={phases} onPhasesChanged={handleSetupChanged} />
            </div>
          )}

          {tab === 'lca-cost' && (
            <LcaCostTab projectId={projectId} />
          )}
        </div>
      </div>
    </DragProvider>
  );
}
