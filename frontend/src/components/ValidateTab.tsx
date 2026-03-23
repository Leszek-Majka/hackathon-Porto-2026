import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type { Discipline } from '../types/setup';
import type { Phase } from '../types/project';
import type { CellSummary } from '../types/matrix';
import type { IFCFileInfo, CellValidation, CellSpecResult } from '../types/validation';

interface Props {
  projectId: number;
  disciplines: Discipline[];
  phases: Phase[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function passRateColor(rate: number): string {
  if (rate >= 0.9) return 'text-green-600 dark:text-green-400';
  if (rate >= 0.6) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function passRateBg(rate: number): string {
  if (rate >= 0.9) return 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800';
  if (rate >= 0.6) return 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
  return 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800';
}

// ── IFC File Panel ─────────────────────────────────────────────────────────────

function IFCFilesPanel({ projectId, selectedId, onSelect, onUploaded }: {
  projectId: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onUploaded: () => void;
}) {
  const [files, setFiles] = useState<IFCFileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(() => {
    api.ifcFiles.list(projectId).then(setFiles).catch(() => {});
  }, [projectId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.ifc')) return;
    setUploading(true);
    try {
      await api.ifcFiles.upload(projectId, file);
      loadFiles();
      onUploaded();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    await api.ifcFiles.delete(projectId, id);
    loadFiles();
    onUploaded();
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">IFC Files</h3>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async e => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".ifc"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-indigo-600">
            <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
            Uploading…
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">Drop .ifc file or click to upload</p>
        )}
      </div>

      {/* File list */}
      <div className="space-y-1.5">
        {files.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">No IFC files uploaded</p>
        )}
        {files.map(f => (
          <div
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${
              selectedId === f.id
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{f.filename}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                {f.ifc_schema} · {f.element_count} elements
              </p>
            </div>
            {selectedId === f.id && (
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex-shrink-0">Selected</span>
            )}
            <button
              onClick={e => { e.stopPropagation(); handleDelete(f.id); }}
              className="flex-shrink-0 p-0.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Validation results detail panel ───────────────────────────────────────────

function ResultsPanel({ validation, onClose, onDownloadBcf }: {
  validation: CellValidation;
  onClose: () => void;
  onDownloadBcf: () => void;
}) {
  const specs: CellSpecResult[] = validation.specs ?? [];
  const summary = validation.summary;
  const passRate = summary?.pass_rate ?? 0;
  const pct = Math.round(passRate * 100);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold ${passRateColor(passRate)}`}>{pct}%</span>
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            <div>
              {summary?.total_elements ?? 0} elements · {summary?.passing_elements ?? 0} passing · {summary?.failing_elements ?? 0} failing
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDownloadBcf}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            BCF
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Spec list */}
      <div className="overflow-y-auto max-h-96 divide-y divide-gray-50 dark:divide-gray-800">
        {specs.length === 0 && (
          <p className="text-xs text-gray-400 px-4 py-3">No requirements checked.</p>
        )}
        {specs.map(spec => {
          const specRate = spec.elements_checked > 0 ? spec.elements_passing / spec.elements_checked : 1;
          return (
            <details key={spec.spec_name} className="group">
              <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 list-none">
                <svg
                  className="w-3 h-3 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{spec.spec_name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{spec.elements_checked} elements</span>
                <span className={`text-xs font-bold flex-shrink-0 ${passRateColor(specRate)}`}>
                  {Math.round(specRate * 100)}%
                </span>
              </summary>
              {spec.failures.length > 0 && (
                <div className="px-4 pb-2 space-y-1">
                  {spec.failures.map((el, i) => (
                    <div key={i} className="bg-red-50 dark:bg-red-900/10 rounded-lg p-2 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-red-700 dark:text-red-400 font-medium">{el.element_type}</span>
                        <span className="text-gray-600 dark:text-gray-400 truncate">{el.element_name || el.element_id}</span>
                        {el.global_id && (
                          <span
                            className="font-mono text-gray-400 text-xs truncate max-w-[100px]"
                            title={el.global_id}
                          >
                            {el.global_id.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {el.failed_requirements.map(r => (
                          <span
                            key={r}
                            className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-mono"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {spec.elements_passing > 0 && (
                    <div className="text-xs text-green-600 dark:text-green-400 px-1">
                      ✓ {spec.elements_passing} element{spec.elements_passing !== 1 ? 's' : ''} passed
                    </div>
                  )}
                </div>
              )}
              {spec.failures.length === 0 && (
                <div className="px-8 pb-2 text-xs text-green-600 dark:text-green-400">
                  ✓ All {spec.elements_checked} element{spec.elements_checked !== 1 ? 's' : ''} passed
                </div>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ValidateTab({ projectId, disciplines, phases }: Props) {
  const [selectedIfcId, setSelectedIfcId] = useState<number | null>(null);
  const [matrixSummary, setMatrixSummary] = useState<CellSummary[]>([]);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [validations, setValidations] = useState<CellValidation[]>([]);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<CellValidation | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.matrix.summary(projectId).then(setMatrixSummary).catch(() => {});
  }, [projectId]);

  const loadValidations = useCallback(() => {
    if (selectedIfcId == null) return;
    api.cellValidation.list(projectId, selectedIfcId).then(setValidations).catch(() => {});
  }, [projectId, selectedIfcId]);

  useEffect(() => { loadValidations(); }, [loadValidations]);

  // Polling for running validations
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const running = validations.filter(v => v.status === 'pending' || v.status === 'running');
    if (running.length === 0) return;
    pollRef.current = setInterval(loadValidations, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [validations, loadValidations]);

  // Load detail when detailId changes or validations update
  useEffect(() => {
    if (detailId == null) { setDetailData(null); return; }
    api.cellValidation.get(projectId, detailId).then(setDetailData).catch(() => {});
  }, [projectId, detailId, validations]);

  function cellKey(discId: number, phaseId: number) { return `${discId}_${phaseId}`; }

  function toggleCell(discId: number, phaseId: number) {
    const key = cellKey(discId, phaseId);
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function runSelected() {
    if (!selectedIfcId || selectedCells.size === 0) return;
    for (const key of selectedCells) {
      const [discId, phaseId] = key.split('_').map(Number);
      try {
        await api.cellValidation.start(projectId, {
          ifc_file_id: selectedIfcId,
          discipline_id: discId,
          phase_id: phaseId,
        });
      } catch { /* ignore individual failures */ }
    }
    setSelectedCells(new Set());
    loadValidations();
  }

  // Latest validation per cell for the selected IFC file
  const latestByCell: Record<string, CellValidation> = {};
  for (const v of validations) {
    const key = cellKey(v.discipline_id, v.phase_id);
    if (!latestByCell[key] || new Date(v.run_at) > new Date(latestByCell[key].run_at)) {
      latestByCell[key] = v;
    }
  }

  const hasCells = disciplines.length > 0 && phases.length > 0;

  return (
    <div className="flex gap-5 h-full min-h-0">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
        <IFCFilesPanel
          projectId={projectId}
          selectedId={selectedIfcId}
          onSelect={id => { setSelectedIfcId(id); setSelectedCells(new Set()); }}
          onUploaded={() => {
            // If nothing selected yet and a file was just uploaded, auto-reload
            loadValidations();
          }}
        />

        {selectedCells.size > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected
            </p>
            <button
              onClick={runSelected}
              disabled={!selectedIfcId}
              className="w-full py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors"
            >
              Run validation
            </button>
            <button
              onClick={() => setSelectedCells(new Set())}
              className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* ── Right: matrix + results ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4 overflow-y-auto">

        {!hasCells && (
          <div className="flex items-center justify-center h-40 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Add disciplines and phases in the Setup tab first.
            </p>
          </div>
        )}

        {hasCells && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Validation Matrix
              </h3>
              {!selectedIfcId && (
                <span className="text-xs text-amber-500 dark:text-amber-400">
                  ← Select an IFC file to enable validation
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 sticky left-0 bg-gray-50 dark:bg-gray-800/50 z-10 min-w-[120px]">
                      Discipline
                    </th>
                    {phases.map(ph => (
                      <th
                        key={ph.id}
                        className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 min-w-[110px]"
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ph.color }} />
                          {ph.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {disciplines.map((disc, di) => (
                    <tr
                      key={disc.id}
                      className={di % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/40 dark:bg-gray-800/20'}
                    >
                      <td
                        className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-gray-800 sticky left-0 z-10"
                        style={{ background: 'inherit' }}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: disc.color }} />
                          {disc.name}
                        </span>
                      </td>
                      {phases.map(ph => {
                        const key = cellKey(disc.id, ph.id);
                        const summary = matrixSummary.find(
                          s => s.discipline_id === disc.id && s.phase_id === ph.id,
                        );
                        const isEmpty = !summary || summary.entry_count === 0;
                        const validation = latestByCell[key];
                        const isSelected = selectedCells.has(key);
                        const isRunning =
                          validation?.status === 'pending' || validation?.status === 'running';

                        return (
                          <td
                            key={ph.id}
                            onClick={() => {
                              if (!isEmpty) {
                                if (validation?.status === 'complete') {
                                  setDetailId(v => (v === validation.id ? null : validation.id));
                                } else if (selectedIfcId) {
                                  toggleCell(disc.id, ph.id);
                                }
                              }
                            }}
                            className={`p-2 border border-gray-50 dark:border-gray-800/60 text-center transition-all ${
                              isEmpty
                                ? 'bg-gray-50/30 dark:bg-gray-800/10'
                                : isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-inset ring-indigo-400 cursor-pointer'
                                : validation?.status === 'complete'
                                ? `${passRateBg(validation.summary?.pass_rate ?? 0)} cursor-pointer`
                                : validation?.status === 'error'
                                ? 'bg-red-50 dark:bg-red-900/10 cursor-default'
                                : 'hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-pointer'
                            }`}
                            style={{ minWidth: '110px', height: '60px' }}
                          >
                            {isEmpty && (
                              <span className="text-gray-300 dark:text-gray-600 text-lg">—</span>
                            )}
                            {!isEmpty && isRunning && (
                              <div className="flex items-center justify-center h-full">
                                <div className="animate-spin w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full" />
                              </div>
                            )}
                            {!isEmpty && !isRunning && validation?.status === 'complete' && (
                              <div className="flex flex-col items-center justify-center h-full gap-0.5">
                                <span className={`text-sm font-bold ${passRateColor(validation.summary?.pass_rate ?? 0)}`}>
                                  {Math.round((validation.summary?.pass_rate ?? 0) * 100)}%
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {validation.summary?.failing_elements ?? 0} fail
                                </span>
                              </div>
                            )}
                            {!isEmpty && !isRunning && validation?.status === 'error' && (
                              <div className="flex items-center justify-center h-full">
                                <span className="text-xs text-red-500 dark:text-red-400 font-medium">Error</span>
                              </div>
                            )}
                            {!isEmpty && !validation && !isSelected && (
                              <div className="flex flex-col items-center justify-center h-full gap-0.5">
                                <span className="text-gray-400 dark:text-gray-500 text-lg">+</span>
                                <span className="text-xs text-gray-300 dark:text-gray-600">
                                  {summary!.entry_count} req
                                </span>
                              </div>
                            )}
                            {!isEmpty && isSelected && (
                              <div className="flex items-center justify-center h-full">
                                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedIfcId && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                Click cells with requirements to select for validation · Click completed cells to view results
              </div>
            )}
          </div>
        )}

        {/* Results panel */}
        {detailId != null && detailData?.status === 'complete' && (
          <ResultsPanel
            validation={detailData}
            onClose={() => setDetailId(null)}
            onDownloadBcf={() => {
              const url = api.cellValidation.bcfUrl(projectId, detailId);
              const a = document.createElement('a');
              a.href = url;
              a.click();
            }}
          />
        )}
      </div>
    </div>
  );
}
