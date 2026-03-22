import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { DashboardData } from '../types/dashboard';

export function useDashboard(projectId: number) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.dashboard.get(projectId);
      setData(d);
    } catch (err) {
      setError(`Failed to load dashboard: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
