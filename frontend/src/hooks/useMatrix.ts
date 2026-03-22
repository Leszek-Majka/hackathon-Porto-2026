import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { CellSummary } from '../types/matrix';

export function useMatrix(projectId: number) {
  const [summary, setSummary] = useState<CellSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.matrix.summary(projectId);
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refreshSummary(); }, [refreshSummary]);

  const getCell = useCallback((did: number, pid: number) =>
    api.matrix.getCell(projectId, did, pid), [projectId]);

  const drop = useCallback(async (did: number, pid: number, payload: any) => {
    const result = await api.matrix.drop(projectId, did, pid, payload);
    await refreshSummary();
    return result;
  }, [projectId, refreshSummary]);

  const updateStatus = useCallback((eid: number, status: string) =>
    api.matrix.updateStatus(projectId, eid, status), [projectId]);

  const deleteEntry = useCallback((eid: number) =>
    api.matrix.deleteEntry(projectId, eid), [projectId]);

  const deleteGroup = useCallback((gkey: string) =>
    api.matrix.deleteGroup(projectId, gkey), [projectId]);

  const getCellSummary = useCallback((did: number, pid: number) =>
    summary.find(s => s.discipline_id === did && s.phase_id === pid), [summary]);

  return { summary, loading, refreshSummary, getCell, drop, updateStatus, deleteEntry, deleteGroup, getCellSummary };
}
