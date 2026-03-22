import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type { ValidationRun, IFCFileInfo } from '../types/validation';

export function useValidation(projectId: number) {
  const [runs, setRuns] = useState<ValidationRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshRuns = useCallback(async () => {
    try {
      const data = await api.validation.list(projectId);
      setRuns(data);
    } catch { /* silent */ }
  }, [projectId]);

  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  // Poll active run every 2s until complete/error
  useEffect(() => {
    if (!activeRunId) return;
    pollRef.current = setInterval(async () => {
      try {
        const run = await api.validation.get(projectId, activeRunId);
        setRuns(prev => prev.map(r => r.id === run.id ? run : r));
        if (run.status === 'complete' || run.status === 'error') {
          clearInterval(pollRef.current!);
          setActiveRunId(null);
        }
      } catch {
        clearInterval(pollRef.current!);
        setActiveRunId(null);
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRunId, projectId]);

  const startValidation = useCallback(async (phaseId: number) => {
    setLoading(true);
    try {
      const { run_id } = await api.validation.start(projectId, phaseId);
      const newRun = await api.validation.get(projectId, run_id);
      setRuns(prev => [newRun, ...prev]);
      setActiveRunId(run_id);
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const deleteRun = useCallback(async (runId: number) => {
    await api.validation.delete(projectId, runId);
    setRuns(prev => prev.filter(r => r.id !== runId));
  }, [projectId]);

  const getRunWithResults = useCallback(async (runId: number): Promise<ValidationRun> => {
    return api.validation.get(projectId, runId);
  }, [projectId]);

  return { runs, activeRunId, loading, startValidation, deleteRun, refreshRuns, getRunWithResults };
}
