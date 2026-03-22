import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Project } from '../types/project';
import type { IDSParsed } from '../types/ids';

export function useProject(projectId: number) {
  const [project, setProject] = useState<Project | null>(null);
  const [ids, setIds] = useState<IDSParsed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.projects.get(projectId);
      setProject(p);
      if (p.ids_file) {
        try {
          const parsed = await api.ids.get(projectId);
          setIds(parsed);
        } catch {
          setIds(null);
        }
      } else {
        setIds(null);
      }
    } catch (err) {
      setError(`Failed to load project: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { project, ids, loading, error, refresh };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.projects.list();
      setProjects(data);
    } catch (err) {
      setError(`Failed to load projects: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, error, refresh };
}
