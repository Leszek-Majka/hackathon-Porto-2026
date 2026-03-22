import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useMatrix } from '../hooks/useMatrix';
import { useValidation } from '../hooks/useValidation';
import { api } from '../api/client';
import type { ValidationRun, IFCFileInfo } from '../types/validation';
import UploadZone from './UploadZone';
import PhaseManager from './PhaseManager';
import SpecMatrix from './SpecMatrix';
import CompareView from './CompareView';
import ExportPanel from './ExportPanel';
import IFCUpload from './IFCUpload';
import ValidationRunner from './ValidationRunner';
import ValidationResults from './ValidationResults';
import ValidationHistory from './ValidationHistory';
import Dashboard from './Dashboard';
import TranslationEditor from './TranslationEditor';

type Tab = 'matrix' | 'compare' | 'validate' | 'dashboard' | 'translations' | 'phases' | 'export';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { project, ids, loading, error, refresh } = useProject(projectId);
  const { matrixData, saving, updateCell } = useMatrix(projectId);
  const { runs, activeRunId, loading: validating, startValidation, deleteRun } = useValidation(projectId);

  const [tab, setTab] = useState<Tab>('matrix');
  const [ifcFile, setIfcFile] = useState<IFCFileInfo | null>(null);
  const [selectedRun, setSelectedRun] = useState<ValidationRun | null>(null);

  const refreshIfc = useCallback(async () => {
    try {
      const info = await api.ifc.info(projectId);
      setIfcFile(info);
    } catch {
      setIfcFile(null);
    }
  }, [projectId]);

  useEffect(() => {
    refreshIfc();
  }, [refreshIfc]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">{error || 'Project not found'}</p>
        <Link to="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const specs = ids?.specifications ?? [];

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'matrix', label: 'Phase Matrix' },
    { id: 'compare', label: 'Compare' },
    { id: 'validate', label: 'Validate' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'translations', label: 'Translations' },
    { id: 'phases', label: 'Phases', badge: project.phases.length },
    { id: 'export', label: 'Export' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-8 pt-6 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-1 inline-block">
              ← Projects
            </Link>
            <h1 className="font-display text-2xl font-semibold text-gray-900 dark:text-white">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
            {ids?.info?.title && (
              <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{ids.info.title}</span>
            )}
            {saving && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
              {t.badge !== undefined && (
                <span className="ml-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">

        {/* Matrix tab */}
        {tab === 'matrix' && (
          <>
            {!project.ids_file ? (
              <div className="max-w-xl mx-auto">
                <div className="mb-6">
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Upload IDS File</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Upload an IDS (.ids) file to start configuring phase requirements.
                  </p>
                </div>
                <UploadZone projectId={projectId} onUploaded={refresh} />
              </div>
            ) : project.phases.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No phases yet.{' '}
                  <button onClick={() => setTab('phases')} className="text-blue-600 dark:text-blue-400 hover:underline">
                    Add phases
                  </button>{' '}
                  to start editing the matrix.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-900 dark:text-white">Requirement × Phase Matrix</h2>
                  <button
                    onClick={refresh}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
                <SpecMatrix
                  specs={specs}
                  phases={project.phases}
                  matrixData={matrixData}
                  saving={saving}
                  onCellChange={updateCell}
                />
              </div>
            )}
          </>
        )}

        {/* Compare tab */}
        {tab === 'compare' && (
          <>
            {!project.ids_file ? (
              <div className="max-w-xl mx-auto">
                <div className="mb-6">
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Upload IDS File</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upload an IDS file first to enable comparison.</p>
                </div>
                <UploadZone projectId={projectId} onUploaded={refresh} />
              </div>
            ) : (
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white mb-5">Phase Comparison</h2>
                <CompareView specs={specs} phases={project.phases} matrixData={matrixData} />
              </div>
            )}
          </>
        )}

        {/* Validate tab */}
        {tab === 'validate' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-1">IFC Validation</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Upload an IFC model and validate it against your phase requirements.
              </p>
            </div>

            <IFCUpload projectId={projectId} ifcFile={ifcFile} onUploaded={refreshIfc} />

            {ifcFile && project.phases.length > 0 && (
              <ValidationRunner
                phases={project.phases}
                activeRunId={activeRunId}
                loading={validating}
                onRun={startValidation}
              />
            )}

            {ifcFile && project.phases.length === 0 && (
              <div className="text-center py-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add phases first to run validation.{' '}
                  <button onClick={() => setTab('phases')} className="text-blue-600 dark:text-blue-400 hover:underline">
                    Go to Phases
                  </button>
                </p>
              </div>
            )}

            {runs.length > 0 && (
              <div className="space-y-4">
                <ValidationHistory
                  runs={runs}
                  phases={project.phases}
                  activeRunId={activeRunId}
                  selectedRunId={selectedRun?.id ?? null}
                  onSelect={setSelectedRun}
                  onDelete={deleteRun}
                />
                {selectedRun && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                      Results — {project.phases.find(p => p.id === selectedRun.phase_id)?.name ?? `Phase ${selectedRun.phase_id}`}
                    </h3>
                    <ValidationResults run={selectedRun} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dashboard tab */}
        {tab === 'dashboard' && (
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-5">Project Dashboard</h2>
            <Dashboard projectId={projectId} phases={project.phases} />
          </div>
        )}

        {/* Translations tab */}
        {tab === 'translations' && (
          <div>
            <div className="mb-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Multilingual Translations</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add translations for specification names, descriptions, and requirement labels.
              </p>
            </div>
            {!project.ids_file ? (
              <div className="max-w-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Upload an IDS file first to manage translations.</p>
                <UploadZone projectId={projectId} onUploaded={refresh} />
              </div>
            ) : (
              <TranslationEditor projectId={projectId} specs={specs} />
            )}
          </div>
        )}

        {/* Phases tab */}
        {tab === 'phases' && (
          <div className="max-w-lg">
            <div className="mb-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Project Phases</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Define the delivery phases for this project.
              </p>
            </div>
            {!project.ids_file && (
              <div className="mb-5">
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IDS File</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Upload an IDS file to enable the matrix editor.</p>
                </div>
                <UploadZone projectId={projectId} onUploaded={refresh} />
              </div>
            )}
            <PhaseManager projectId={projectId} phases={project.phases} onChanged={refresh} />
          </div>
        )}

        {/* Export tab */}
        {tab === 'export' && (
          <div className="max-w-md">
            {!project.ids_file ? (
              <div className="max-w-xl">
                <div className="mb-6">
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Upload IDS File</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upload an IDS file first to enable export.</p>
                </div>
                <UploadZone projectId={projectId} onUploaded={refresh} />
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Export IDS Files</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Download phase-specific IDS files with adjusted requirement cardinalities.
                  </p>
                </div>
                <ExportPanel projectId={projectId} phases={project.phases} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
