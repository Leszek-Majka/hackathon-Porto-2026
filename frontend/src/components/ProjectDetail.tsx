import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useSetup } from '../hooks/useSetup';
import { DragProvider } from '../dnd/DragContext';
import AppNav from './AppNav';
import SetupTab from './SetupTab';
import SourcesTab from './SourcesTab';
import MatrixTab from './MatrixTab';
import ExportTab from './ExportTab';

type AppTab = 'setup' | 'sources' | 'matrix' | 'export';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const { project, loading: projectLoading, error: projectError, refresh: refreshProject } = useProject(projectId);
  const { phases, disciplines, loading: setupLoading, refresh: refreshSetup } = useSetup(projectId);

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
        {/* Back link */}
        <div className="px-8 pt-4">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ← Projects
          </Link>
          <h1 className="font-display text-xl font-semibold text-gray-900 dark:text-white mt-1">
            {project.name}
          </h1>
          {project.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{project.description}</p>
          )}
        </div>

        {/* Navigation */}
        <AppNav
          activeTab={tab}
          onTabChange={setTab}
          projectName={project.name}
        />

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
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

          {tab === 'export' && (
            <ExportTab
              projectId={projectId}
              disciplines={disciplines}
              phases={phases}
            />
          )}
        </div>
      </div>
    </DragProvider>
  );
}
