import React, { useState } from 'react';
import type { CellEntry, SpecMeta } from '../types/matrix';
import type { IDSSource } from '../types/sources';
import EntryRow from './EntryRow';
import ApplicabilityChips from './ApplicabilityChips';

interface Props {
  specName: string;
  entries: CellEntry[];
  sources: IDSSource[];
  selectedIds: Set<number>;
  lastSelectedId: number | null;
  onSelectEntry: (eid: number, e: React.MouseEvent) => void;
  onStatusChange: (eid: number, status: string) => Promise<void>;
  onDeleteEntry: (eid: number) => Promise<void>;
  onDeleteAllInSpec: (specName: string, groupKeys: string[]) => Promise<void>;
  onUpdateValues?: (eid: number, values: string[]) => Promise<void>;
  onUpdateSpecMeta: (specName: string, meta: SpecMeta) => Promise<void>;
}

/** Merge all unique applicability objects across entries in this spec (deduplicate by JSON key). */
function mergeApplicabilities(entries: CellEntry[]): Record<string, any>[] {
  const seen = new Set<string>();
  const result: Record<string, any>[] = [];
  for (const e of entries) {
    for (const app of e.applicability ?? []) {
      const key = JSON.stringify(app);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(app);
      }
    }
  }
  return result;
}

export default function SpecGroupPanel({
  specName, entries, sources, selectedIds, lastSelectedId, onSelectEntry,
  onStatusChange, onDeleteEntry, onDeleteAllInSpec, onUpdateValues, onUpdateSpecMeta,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);

  const rawMeta = entries[0]?.spec_meta ?? { identifier: '', description: '', instructions: '', ifc_version: '' };
  const [meta, setMeta] = useState<SpecMeta>(rawMeta);
  const [saving, setSaving] = useState(false);

  const applicabilities = mergeApplicabilities(entries);
  const groupKeys = [...new Set(entries.map(e => e.group_key))];

  // Collect unique IDS sources referenced by entries in this spec
  const sourceIds = [...new Set(entries.map(e => e.source_ids_id).filter((id): id is number => id != null))];
  const sourceLabels = sourceIds.map(id => {
    const s = sources.find(src => src.id === id);
    return s ? (s.title || s.filename) : `IDS #${id}`;
  });

  async function saveMeta() {
    setSaving(true);
    try {
      await onUpdateSpecMeta(specName, meta);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">

      {/* ── Spec header ── */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        {/* Row 1: chevron · name · badges · actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Spec name */}
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">
            {specName}
          </span>

          {/* Entry count */}
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
            {entries.length} req{entries.length !== 1 ? 's' : ''}
          </span>

          {/* Edit metadata */}
          <button
            onClick={() => setMetaOpen(v => !v)}
            title="Edit specification metadata"
            className={`flex-shrink-0 p-0.5 rounded transition-colors ${
              metaOpen ? 'text-indigo-500' : 'text-gray-400 hover:text-indigo-500'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Delete all */}
          <button
            onClick={() => onDeleteAllInSpec(specName, groupKeys)}
            className="flex-shrink-0 p-0.5 text-gray-400 hover:text-red-500 transition-colors rounded"
            title="Remove all requirements from this specification"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Row 2: IDS source badge(s) */}
        {sourceLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 ml-5">
            {sourceLabels.map(label => (
              <span
                key={label}
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium"
              >
                <svg className="w-3 h-3 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Row 3: identifier + ifc_version badges (only if present) */}
        {(meta.identifier || meta.ifc_version) && (
          <div className="flex flex-wrap gap-1 mt-1 ml-5">
            {meta.identifier && (
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {meta.identifier}
              </span>
            )}
            {meta.ifc_version && (
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                {meta.ifc_version}
              </span>
            )}
          </div>
        )}

        {/* Row 3: combined applicability chips */}
        {applicabilities.length > 0 && (
          <div className="ml-5 mt-0.5">
            {applicabilities.map((app, i) => (
              <ApplicabilityChips key={i} applicability={app} variant="entry" />
            ))}
          </div>
        )}
      </div>

      {/* ── Metadata editor (expandable) ── */}
      {metaOpen && (
        <div className="px-3 py-2.5 bg-indigo-50/40 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-900/40 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Identifier</label>
              <input
                type="text"
                value={meta.identifier}
                onChange={e => setMeta(m => ({ ...m, identifier: e.target.value }))}
                placeholder="SP01, Fire-001, …"
                className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">IFC Version</label>
              <input
                type="text"
                value={meta.ifc_version}
                onChange={e => setMeta(m => ({ ...m, ifc_version: e.target.value }))}
                placeholder="IFC4, IFC4X3_ADD2, …"
                className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Description</label>
            <textarea
              value={meta.description}
              onChange={e => setMeta(m => ({ ...m, description: e.target.value }))}
              placeholder="Why is this specification important to the project?"
              rows={2}
              className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Instructions</label>
            <textarea
              value={meta.instructions}
              onChange={e => setMeta(m => ({ ...m, instructions: e.target.value }))}
              placeholder="Who is responsible? How should it be achieved?"
              rows={2}
              className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={saveMeta}
              disabled={saving}
              className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Entry rows ── */}
      {!collapsed && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map(entry => {
            const src = sources.find(s => s.id === entry.source_ids_id);
            const label = src ? (src.title || src.filename) : undefined;
            return (
              <EntryRow
                key={entry.id}
                entry={entry}
                sourceLabel={label}
                isSelected={selectedIds.has(entry.id)}
                onSelect={onSelectEntry}
                onStatusChange={onStatusChange}
                onDelete={onDeleteEntry}
                onUpdateValues={onUpdateValues}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
