import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Discipline } from '../types/setup';
import type { Phase } from '../types/project';

export function useSetup(projectId: number) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        api.phases.list(projectId),
        api.disciplines.list(projectId),
      ]);
      setPhases(p);
      setDisciplines(d);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { phases, disciplines, loading, refresh };
}
