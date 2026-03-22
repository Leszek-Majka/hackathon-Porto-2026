import React, { useState, useRef, KeyboardEvent } from 'react';
import { api } from '../api/client';
import type { AutoFillResponse, AutoFillPreviewSpec } from '../types/project';

interface Props {
  projectId: number;
  phaseId: number;
  phaseName: string;
  onApplied: () => void;
}

export default function AutoFillPanel({ projectId, phaseId, phaseName, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [applyStatus, setApplyStatus] = useState<'required' | 'optional'>('required');
  const [preview, setPreview] = useState<AutoFillResponse | null>(null);
  const [previewFilters, setPreviewFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtersChanged = JSON.stringify(tags) !== JSON.stringify(previewFilters);
  const canApply = preview !== null && preview.matched_specs > 0 && !preview.error && !filtersChanged && tags.length > 0;

  function addTag(value: string) {
    const v = value.trim().replace(/,/g, '');
    if (v && !tags.includes(v)) {
      setTags(prev => [...prev, v]);
      setPreview(null);
    }
    setInput('');
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag));
    setPreview(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  async function runPreview() {
    if (tags.length === 0) return;
    setLoading(true);
    try {
      const result = await api.autofill.run(projectId, phaseId, tags, applyStatus, true);
      // backend returns preview list under "preview" key for dry_run=true
      setPreview({ ...result, preview: result.preview ?? [] });
      setPreviewFilters([...tags]);
    } catch (err) {
      setPreview({ dry_run: true, matched_specs: 0, matched_requirements: 0, updated_cells: 0, preview: [], error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function runApply() {
    if (!canApply) return;
    setLoading(true);
    try {
      const result = await api.autofill.run(projectId, phaseId, tags, applyStatus, false);
      setToast(`${result.updated_cells} cells updated in ${phaseName}`);
      setTimeout(() => setToast(null), 4000);
      setPreview(null);
      setPreviewFilters([]);
      onApplied();
    } catch (err) {
      setToast(`Error: ${String(err)}`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
          toast.startsWith('Error') ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast}
        </div>
      )}

      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-green-700 dark:text-green-400">✦</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Smart Auto-Fill</span>
          {tags.length > 0 && (
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-mono">
              {tags.length} filter{tags.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-1 p-4 bg-[#F0F7F0] dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl space-y-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Type keywords to automatically set requirements as <strong>Required</strong> or <strong>Optional</strong> for phase <strong>{phaseName}</strong>.
          </p>

          {/* Tag input */}
          <div>
            <div
              className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg cursor-text min-h-[40px]"
              onClick={() => inputRef.current?.focus()}
            >
              {tags.map(tag => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-white dark:bg-gray-800 border border-green-400 dark:border-green-600 text-green-800 dark:text-green-300 rounded"
                >
                  {tag}
                  <button
                    onClick={e => { e.stopPropagation(); removeTag(tag); }}
                    className="text-green-500 hover:text-red-500 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (input.trim()) addTag(input); }}
                placeholder={tags.length === 0 ? 'e.g. IfcWall, Pset_WallCommon, LoadBearing' : ''}
                className="flex-1 min-w-[180px] text-xs outline-none bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add a keyword</p>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Set matched as:</span>
            {(['required', 'optional'] as const).map(s => (
              <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  value={s}
                  checked={applyStatus === s}
                  onChange={() => { setApplyStatus(s); setPreview(null); }}
                  className="accent-green-600"
                />
                <span className={`text-xs font-medium capitalize ${
                  s === 'required' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'
                }`}>
                  {s}
                </span>
              </label>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={runPreview}
              disabled={loading || tags.length === 0}
              className="px-3 py-1.5 text-xs font-medium border border-green-600 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-40 transition-colors"
            >
              {loading ? 'Loading...' : 'Preview'}
            </button>
            <button
              onClick={runApply}
              disabled={!canApply || loading}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              Apply
            </button>
            {preview && filtersChanged && (
              <span className="text-xs text-amber-600 dark:text-amber-400">Filters changed — re-run Preview</span>
            )}
          </div>

          {/* Preview results */}
          {preview && (
            <div className={`rounded-lg p-3 text-xs transition-all ${
              preview.error
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                : preview.matched_specs === 0
                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            }`}>
              {preview.error ? (
                <p className="text-red-700 dark:text-red-400">{preview.error}</p>
              ) : preview.matched_specs === 0 ? (
                <p className="text-amber-700 dark:text-amber-400">No specifications matched these filters.</p>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium text-green-800 dark:text-green-300">
                    {preview.matched_specs} specification{preview.matched_specs !== 1 ? 's' : ''} · {preview.matched_requirements} requirement{preview.matched_requirements !== 1 ? 's' : ''} will be updated
                  </p>
                  {preview.preview.map((spec: AutoFillPreviewSpec) => (
                    <div key={spec.spec_name}>
                      <p className="font-medium text-gray-700 dark:text-gray-300">{spec.spec_name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {spec.surviving_requirements.map((req, i) => (
                          <span key={i} className="font-mono px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded text-green-800 dark:text-green-300">
                            {req.baseName ?? req.name ?? req.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
