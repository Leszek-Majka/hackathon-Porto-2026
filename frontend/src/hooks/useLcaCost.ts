import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { LcaCostData, LcaCostParams } from '../types/lcaCost';

export function useLcaCost(projectId: number) {
  const [data, setData] = useState<LcaCostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.lcaCost.get(projectId);
      setData(d);
    } catch (err) {
      setError(`Failed to load LCA cost data: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const compute = useCallback(async () => {
    setComputing(true);
    setError(null);
    try {
      const d = await api.lcaCost.compute(projectId);
      setData(d);
    } catch (err) {
      setError(`Failed to compute: ${err}`);
    } finally {
      setComputing(false);
    }
  }, [projectId]);

  const updateParams = useCallback(async (params: LcaCostParams) => {
    setComputing(true);
    setError(null);
    try {
      const d = await api.lcaCost.updateParams(projectId, params);
      setData(d);
    } catch (err) {
      setError(`Failed to update params: ${err}`);
    } finally {
      setComputing(false);
    }
  }, [projectId]);

  return { data, loading, computing, error, compute, updateParams, refresh };
}
