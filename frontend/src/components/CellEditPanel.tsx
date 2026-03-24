import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';
import type { CellData, CellEntry, SpecMeta } from '../types/matrix';
import type { IDSSource } from '../types/sources';
import CellHeaderEditor from './CellHeader';
import SpecGroupPanel from './SpecGroupPanel';

interface Props {
  projectId: number;
  disciplineId: number;
  phaseId: number;
  disciplineName: string;
  phaseName: string;
  sources: IDSSource[];
  onClose: () => void;
  onChanged: () => void;
  refreshToken?: number;
}

// Height of the scrollable content area in rem — keep in sync with MatrixTab paddingBottom
export const CELL_PANEL_CONTENT_HEIGHT = '22rem';

const STATUS_OPTIONS = ['required', 'optional', 'excluded', 'prohibited'] as const;
type Status = typeof STATUS_OPTIONS[number];

const STATUS_STYLES: Record<Status, string> = {
  required:   'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300',
  optional:   'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300',
  excluded:   'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400',
  prohibited: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300',
};

export default function CellEditPanel({
  projectId, disciplineId, phaseId, disciplineName, phaseName,
  sources, onClose, onChanged, refreshToken,
}: Props) {
  const [cellData, setCellData] = useState<CellData | null>(null);
  const [loading, setLoading] = useState(true);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadCell(silent = false) {
    const savedScroll = scrollRef.current?.scrollTop ?? 0;
    if (!silent) setLoading(true);
    try {
      const data = await api.matrix.getCell(projectId, disciplineId, phaseId);
      setCellData(data);
      if (silent) {
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = savedScroll;
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { loadCell(); }, [disciplineId, phaseId]);

  useEffect(() => {
    if (refreshToken && refreshToken > 0) loadCell(true);
  }, [refreshToken]);

  // Clear selection when cell changes
  useEffect(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, [disciplineId, phaseId]);

  async function handleHeaderSave(header: any) {
    await api.matrix.updateHeader(projectId, disciplineId, phaseId, header);
    await loadCell();
  }

  async function handleStatusChange(eid: number, status: string) {
    // If the clicked entry is selected → apply to all selected; otherwise just this one
    const targets = selectedIds.has(eid) && selectedIds.size > 1
      ? [...selectedIds]
      : [eid];
    await Promise.all(targets.map(id => api.matrix.updateStatus(projectId, id, status)));
    await loadCell(true);
    onChanged();
  }

  async function handleBulkStatus(status: string) {
    if (selectedIds.size === 0) return;
    await Promise.all([...selectedIds].map(id => api.matrix.updateStatus(projectId, id, status)));
    await loadCell(true);
    onChanged();
  }

  async function handleDeleteEntry(eid: number) {
    await api.matrix.deleteEntry(projectId, eid);
    setSelectedIds(prev => { const next = new Set(prev); next.delete(eid); return next; });
    await loadCell(true);
    onChanged();
  }

  async function handleUpdateValues(eid: number, values: string[]) {
    await api.matrix.updateEntryValues(projectId, eid, values);
    await loadCell(true);
  }

  async function handleDeleteAllInSpec(_specName: string, groupKeys: string[]) {
    await Promise.all(groupKeys.map(gk => api.matrix.deleteGroup(projectId, gk)));
    await loadCell(true);
    onChanged();
  }

  async function handleUpdateSpecMeta(specName: string, meta: SpecMeta) {
    await api.matrix.updateSpecMeta(projectId, disciplineId, phaseId, specName, meta);
    await loadCell(true);
  }

  // Flat ordered list of all entry IDs (for shift-range selection)
  const allEntryIds: number[] = cellData?.entries.map(e => e.id) ?? [];

  const handleSelectEntry = useCallback((eid: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedId !== null) {
      // Range select between lastSelectedId and eid
      const fromIdx = allEntryIds.indexOf(lastSelectedId);
      const toIdx = allEntryIds.indexOf(eid);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        const rangeIds = allEntryIds.slice(lo, hi + 1);
        setSelectedIds(prev => new Set([...prev, ...rangeIds]));
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(eid)) next.delete(eid); else next.add(eid);
        return next;
      });
      setLastSelectedId(eid);
    } else {
      // Plain click: toggle single (keep selection if already the only one)
      setSelectedIds(prev => {
        if (prev.size === 1 && prev.has(eid)) return new Set();
        return new Set([eid]);
      });
      setLastSelectedId(eid);
    }
  }, [allEntryIds, lastSelectedId]);

  function groupBySpec(entries: CellEntry[]): Array<{ specName: string; entries: CellEntry[] }> {
    const map = new Map<string, CellEntry[]>();
    for (const entry of entries) {
      if (!map.has(entry.spec_name)) map.set(entry.spec_name, []);
      map.get(entry.spec_name)!.push(entry);
    }
    return Array.from(map.entries()).map(([specName, entries]) => ({ specName, entries }));
  }

  const specGroups = cellData ? groupBySpec(cellData.entries) : [];
  const selCount = selectedIds.size;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-2xl">

      {/* ── Title bar ── */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{disciplineName}</h3>
          <span className="text-gray-400 dark:text-gray-500">×</span>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{phaseName}</h3>
          {cellData && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {cellData.entries.length} requirement{cellData.entries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Content row — explicit height so each column can scroll independently ── */}
      <div className="flex gap-0 items-stretch" style={{ height: CELL_PANEL_CONTENT_HEIGHT }}>

        {/* IDS Header — fixed, no scroll, collapsible to the right */}
        {headerCollapsed ? (
          /* Collapsed strip */
          <div className="flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setHeaderCollapsed(false)}
              title="Expand IDS Header"
              className="flex flex-col items-center justify-center gap-2 flex-1 px-2 bg-gray-50 dark:bg-gray-800/50 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-xs font-semibold tracking-wide" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
                IDS Header
              </span>
            </button>
          </div>
        ) : (
          /* Expanded header — fixed width, no overflow needed (fixed field count) */
          <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-4">
              {loading ? null : (
                <CellHeaderEditor
                  header={cellData?.header ?? { title: '', author: '', date: '', version: '', description: '', copyright: '', purpose: '', milestone: '' }}
                  sources={sources}
                  onSave={handleHeaderSave}
                  collapsed={false}
                  onToggleCollapse={() => setHeaderCollapsed(true)}
                />
              )}
            </div>
          </div>
        )}

        {/* Entries — takes remaining width, scrolls independently */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* ── Bulk action bar (visible when ≥1 selected) ── */}
          {selCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 flex-shrink-0">
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mr-1">
                {selCount} selected:
              </span>
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleBulkStatus(s)}
                  className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${STATUS_STYLES[s]}`}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => { setSelectedIds(new Set()); setLastSelectedId(null); }}
                className="ml-auto text-xs text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
              >
                clear
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
              </div>
            ) : specGroups.length === 0 ? (
              <div className="flex items-center justify-center h-full border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center px-4">
                  Drag specifications or requirements from the IDS Browser into this cell to add them.
                </p>
              </div>
            ) : (
              specGroups.map(g => (
                <SpecGroupPanel
                  key={g.specName}
                  specName={g.specName}
                  entries={g.entries}
                  sources={sources}
                  selectedIds={selectedIds}
                  lastSelectedId={lastSelectedId}
                  onSelectEntry={handleSelectEntry}
                  onStatusChange={handleStatusChange}
                  onDeleteEntry={handleDeleteEntry}
                  onDeleteAllInSpec={handleDeleteAllInSpec}
                  onUpdateValues={handleUpdateValues}
                  onUpdateSpecMeta={handleUpdateSpecMeta}
                />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
