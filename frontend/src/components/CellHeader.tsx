import React, { useState, useEffect, useRef } from 'react';
import type { CellHeader as CellHeaderType } from '../types/matrix';
import type { IDSSource } from '../types/sources';

interface Props {
  header: CellHeaderType;
  sources: IDSSource[];
  onSave: (header: CellHeaderType) => Promise<void>;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

type HeaderKey = keyof CellHeaderType;

const EMPTY_HEADER: CellHeaderType = {
  title: '',
  author: '',
  date: '',
  version: '',
  description: '',
  copyright: '',
  purpose: '',
  milestone: '',
};

interface FieldDef {
  key: HeaderKey;
  label: string;
  placeholder: string;
  required?: boolean;
  span: 'full' | 'half';
  type?: 'date';
}

const FIELDS: FieldDef[] = [
  { key: 'title',       label: 'Title',       placeholder: 'IDS title...',                          required: true, span: 'full' },
  { key: 'description', label: 'Description', placeholder: 'Description of content and purpose...',  span: 'full' },
  { key: 'author',      label: 'Author',      placeholder: 'author@example.com',                     span: 'half' },
  { key: 'date',        label: 'Date',        placeholder: 'YYYY-MM-DD',                             span: 'half', type: 'date' },
  { key: 'version',     label: 'Version',     placeholder: '1.0',                                    span: 'half' },
  { key: 'copyright',   label: 'Copyright',   placeholder: 'Organization name...',                   span: 'half' },
  { key: 'purpose',     label: 'Purpose',     placeholder: 'e.g. Construction Documentation',        span: 'half' },
  { key: 'milestone',   label: 'Milestone',   placeholder: 'e.g. LOD 300',                           span: 'half' },
];

const FIELD_LABEL: Record<HeaderKey, string> = Object.fromEntries(
  FIELDS.map(f => [f.key, f.label])
) as Record<HeaderKey, string>;

// ── Copy-from conflict ───────────────────────────────────────────────────────
interface CopyConflict {
  key: HeaderKey;
  currentValue: string;
  newValue: string;
  apply: boolean;  // whether user wants to overwrite with newValue
}

// ── New-cell header conflict ─────────────────────────────────────────────────
export default function CellHeader({ header, sources, onSave, collapsed, onToggleCollapse }: Props) {
  const [local, setLocal]               = useState<CellHeaderType>({ ...EMPTY_HEADER, ...header });
  const [saving, setSaving]             = useState(false);
  const [dirtyFields, setDirtyFields]   = useState<Set<HeaderKey>>(new Set());
  const [pendingHeader, setPendingHeader] = useState<CellHeaderType | null>(null);
  const [copyConflicts, setCopyConflicts] = useState<CopyConflict[] | null>(null);
  const pendingSource = useRef<CellHeaderType | null>(null);
  const isFirstMount = useRef(true);

  // ── Sync incoming header prop (cell switch) ────────────────────────────────
  useEffect(() => {
    const incoming = { ...EMPTY_HEADER, ...header };
    if (isFirstMount.current) {
      isFirstMount.current = false;
      setLocal(incoming);
      return;
    }
    if (dirtyFields.size === 0) {
      setLocal(incoming);
      return;
    }
    const hasConflict = Array.from(dirtyFields).some(k => incoming[k] !== local[k]);
    if (hasConflict) {
      setPendingHeader(incoming);
    } else {
      setLocal(prev => {
        const merged = { ...incoming };
        dirtyFields.forEach(k => { merged[k] = prev[k]; });
        return merged;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header]);

  // ── Field editing ──────────────────────────────────────────────────────────
  function handleChange(key: HeaderKey, value: string) {
    setLocal(prev => ({ ...prev, [key]: value }));
    setDirtyFields(prev => new Set([...prev, key]));
  }

  async function handleBlur() {
    if (dirtyFields.size === 0) return;
    setSaving(true);
    try {
      await onSave(local);
      setDirtyFields(new Set());
    } finally {
      setSaving(false);
    }
  }

  // ── New-cell conflict resolution ───────────────────────────────────────────
  function applyNewHeader() {
    if (!pendingHeader) return;
    setLocal(pendingHeader);
    setDirtyFields(new Set());
    setPendingHeader(null);
    onSave(pendingHeader);
  }

  function keepCurrentValues() {
    if (!pendingHeader) return;
    setLocal(prev => {
      const merged = { ...pendingHeader };
      dirtyFields.forEach(k => { merged[k] = prev[k]; });
      return merged;
    });
    setPendingHeader(null);
  }

  // ── Copy-from IDS source ───────────────────────────────────────────────────
  function handleCopyFrom(sourceId: number) {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;

    const sourceValues: Partial<CellHeaderType> = {
      title:       source.title,
      author:      source.author,
      date:        source.date,
      version:     source.version,
      description: source.description,
      copyright:   source.copyright,
      purpose:     source.purpose,
      milestone:   source.milestone,
    };

    // Build full merged header (source overwrites where source has a value)
    const fullMerged: CellHeaderType = { ...local };
    (Object.keys(sourceValues) as HeaderKey[]).forEach(k => {
      if (sourceValues[k]) fullMerged[k] = sourceValues[k]!;
    });

    // Detect conflicts: field where local has a non-empty value AND source differs
    const conflicts: CopyConflict[] = [];
    (Object.keys(sourceValues) as HeaderKey[]).forEach(k => {
      const src = sourceValues[k] ?? '';
      const cur = local[k];
      if (src && cur && src !== cur) {
        conflicts.push({ key: k, currentValue: cur, newValue: src, apply: true });
      }
    });

    if (conflicts.length === 0) {
      // No conflicts — apply directly
      setLocal(fullMerged);
      setDirtyFields(new Set());
      onSave(fullMerged);
    } else {
      // Store the full merged result for later, show dialog
      pendingSource.current = fullMerged;
      setCopyConflicts(conflicts);
    }
  }

  function applyCopyConflicts() {
    if (!copyConflicts || !pendingSource.current) return;
    const result = { ...local };
    // Apply fields from source only where user checked "apply"
    copyConflicts.forEach(c => {
      if (c.apply) result[c.key] = c.newValue;
    });
    // Also apply non-conflicting fields from pendingSource
    const applied = { ...pendingSource.current };
    copyConflicts.filter(c => !c.apply).forEach(c => { applied[c.key] = local[c.key]; });
    setLocal(applied);
    setDirtyFields(new Set());
    setCopyConflicts(null);
    pendingSource.current = null;
    onSave(applied);
  }

  function toggleConflictApply(key: HeaderKey) {
    setCopyConflicts(prev =>
      prev ? prev.map(c => c.key === key ? { ...c, apply: !c.apply } : c) : prev
    );
  }

  const hasDirty = dirtyFields.size > 0;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">

      {/* ── Panel title bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 flex-1 text-left group"
          title="Collapse IDS Header"
        >
          <svg
            className="w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform flex-shrink-0 rotate-180"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            IDS Header
          </span>
          {saving && <span className="text-xs text-amber-500 ml-1">Saving...</span>}
          {hasDirty && !saving && (
            <span className="text-xs text-orange-500 dark:text-orange-400 ml-1">Unsaved</span>
          )}
        </button>

        {sources.length > 0 && (
          <select
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 ml-2"
            defaultValue=""
            onChange={e => {
              if (e.target.value) handleCopyFrom(Number(e.target.value));
              e.target.value = '';
            }}
          >
            <option value="">Copy from IDS source...</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>{s.filename}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Copy-from conflict dialog ── */}
      {copyConflicts && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
            The selected source has different values for these fields. Choose which to keep:
          </p>
          <div className="space-y-2 mb-3">
            {copyConflicts.map(c => (
              <label
                key={c.key}
                className="flex items-start gap-2 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={c.apply}
                  onChange={() => toggleConflictApply(c.key)}
                  className="mt-0.5 flex-shrink-0 accent-amber-600"
                />
                <div className="min-w-0">
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    {FIELD_LABEL[c.key]}
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 space-y-0.5">
                    <div>
                      <span className="text-gray-400">Current: </span>
                      <span className="font-mono text-gray-700 dark:text-gray-300">{c.currentValue}</span>
                    </div>
                    <div>
                      <span className="text-amber-600 dark:text-amber-400">New: </span>
                      <span className="font-mono text-amber-800 dark:text-amber-200">{c.newValue}</span>
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={applyCopyConflicts}
              className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
            >
              Apply selected
            </button>
            <button
              onClick={() => { setCopyConflicts(null); pendingSource.current = null; }}
              className="px-3 py-1 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── New-cell conflict dialog ── */}
      {pendingHeader && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
            New cell has different header values.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
            Unsaved fields: <span className="font-mono">{Array.from(dirtyFields).map(k => FIELD_LABEL[k]).join(', ')}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={keepCurrentValues}
              className="px-3 py-1 text-xs font-medium bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-300 rounded hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            >
              Keep my values
            </button>
            <button
              onClick={applyNewHeader}
              className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
            >
              Use new values
            </button>
          </div>
        </div>
      )}

      {/* ── Fields ── */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map(f => {
            const isDirty = dirtyFields.has(f.key);
            return (
              <div key={f.key} className={f.span === 'full' ? 'col-span-2' : ''}>
                <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  {f.label}
                  {f.required && <span className="text-red-400">*</span>}
                  {isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" title="Unsaved change" />
                  )}
                </label>
                <input
                  type={f.type === 'date' ? 'date' : 'text'}
                  value={local[f.key]}
                  onChange={e => handleChange(f.key, e.target.value)}
                  onBlur={handleBlur}
                  placeholder={f.placeholder}
                  className={`w-full px-2 py-1 text-xs border rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${
                    isDirty
                      ? 'border-orange-300 dark:border-orange-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
