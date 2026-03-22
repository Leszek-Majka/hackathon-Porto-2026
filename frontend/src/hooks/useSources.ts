import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { IDSSource } from '../types/sources';

export function useSources(projectId: number) {
  const [sources, setSources] = useState<IDSSource[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.sources.list(projectId);
      setSources(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const upload = useCallback(async (file: File) => {
    const result = await api.sources.upload(projectId, file);
    setSources(prev => [...prev, result]);
    return result;
  }, [projectId]);

  const remove = useCallback(async (sid: number) => {
    await api.sources.delete(projectId, sid);
    setSources(prev => prev.filter(s => s.id !== sid));
  }, [projectId]);

  return { sources, loading, refresh, upload, remove };
}
