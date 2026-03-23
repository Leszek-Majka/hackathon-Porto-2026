import { useState, useEffect, useRef } from 'react';
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

export default function CellEditPanel({
  projectId, disciplineId, phaseId, disciplineName, phaseName,
  sources, onClose, onChanged, refreshToken,
}: Props) {
  const [cellData, setCellData] = useState<CellData | null>(null);
  const [loading, setLoading] = useState(true);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
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

  async function handleHeaderSave(header: any) {
    await api.matrix.updateHeader(projectId, disciplineId, phaseId, header);
    await loadCell();
  }

  async function handleStatusChange(eid: number, status: string) {
    await api.matrix.updateStatus(projectId, eid, status);
    await loadCell(true);
    onChanged();
  }

  async function handleDeleteEntry(eid: number) {
    await api.matrix.deleteEntry(projectId, eid);
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

  function groupBySpec(entries: CellEntry[]): Array<{ specName: string; entries: CellEntry[] }> {
    const map = new Map<string, CellEntry[]>();
    for (const entry of entries) {
      if (!map.has(entry.spec_name)) map.set(entry.spec_name, []);
      map.get(entry.spec_name)!.push(entry);
    }
    return Array.from(map.entries()).map(([specName, entries]) => ({ specName, entries }));
  }

  const specGroups = cellData ? groupBySpec(cellData.entries) : [];

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
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto p-4 space-y-3">
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
  );
}
