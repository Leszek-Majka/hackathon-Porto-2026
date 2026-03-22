import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import type { CellData, CellEntry } from '../types/matrix';
import type { IDSSource } from '../types/sources';
import CellHeaderEditor from './CellHeader';
import EntryGroup from './EntryGroup';

interface Props {
  projectId: number;
  disciplineId: number;
  phaseId: number;
  disciplineName: string;
  phaseName: string;
  sources: IDSSource[];
  onClose: () => void;
  onChanged: () => void;
}

export default function CellEditPanel({
  projectId, disciplineId, phaseId, disciplineName, phaseName,
  sources, onClose, onChanged,
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

  useEffect(() => {
    loadCell();
  }, [disciplineId, phaseId]);

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

  async function handleDeleteGroup(gkey: string) {
    await api.matrix.deleteGroup(projectId, gkey);
    await loadCell(true);
    onChanged();
  }

  // Group entries by spec_name + group_key
  function groupEntries(entries: CellEntry[]): Array<{ specName: string; groupKey: string; entries: CellEntry[] }> {
    const map = new Map<string, { specName: string; groupKey: string; entries: CellEntry[] }>();
    for (const entry of entries) {
      const key = `${entry.spec_name}|${entry.group_key}`;
      if (!map.has(key)) {
        map.set(key, { specName: entry.spec_name, groupKey: entry.group_key, entries: [] });
      }
      map.get(key)!.entries.push(entry);
    }
    return Array.from(map.values());
  }

  const groups = cellData ? groupEntries(cellData.entries) : [];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-xl">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {disciplineName}
          </h3>
          <span className="text-gray-400 dark:text-gray-500">×</span>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {phaseName}
          </h3>
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

      {/* Panel content */}
      <div ref={scrollRef} className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="flex gap-4 p-4 items-start">

            {/* Header column — expanded or collapsed strip */}
            {headerCollapsed ? (
              <div className="flex-shrink-0 flex flex-col items-center">
                <button
                  onClick={() => setHeaderCollapsed(false)}
                  title="Expand IDS Header"
                  className="flex flex-col items-center gap-1.5 px-1.5 py-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
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
              <div className="w-1/3 flex-shrink-0">
                <CellHeaderEditor
                  header={cellData?.header ?? { title: '', author: '', date: '', version: '', description: '', copyright: '', purpose: '', milestone: '' }}
                  sources={sources}
                  onSave={handleHeaderSave}
                  collapsed={false}
                  onToggleCollapse={() => setHeaderCollapsed(true)}
                />
              </div>
            )}

            {/* Entry groups — expands to full width when header is collapsed */}
            <div className="flex-1 min-w-0 space-y-3">
              {groups.length === 0 ? (
                <div className="flex items-center justify-center h-32 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center px-4">
                    Drag specifications or requirements from the IDS Browser into this cell to add them.
                  </p>
                </div>
              ) : (
                groups.map(g => (
                  <EntryGroup
                    key={`${g.specName}|${g.groupKey}`}
                    specName={g.specName}
                    groupKey={g.groupKey}
                    entries={g.entries}
                    onStatusChange={handleStatusChange}
                    onDeleteEntry={handleDeleteEntry}
                    onDeleteGroup={handleDeleteGroup}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
