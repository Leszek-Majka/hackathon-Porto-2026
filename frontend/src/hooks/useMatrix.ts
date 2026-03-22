import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type { MatrixData, MatrixStatus } from '../types/project';

export function useMatrix(projectId: number) {
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const refreshMatrix = useCallback(async () => {
    try {
      const data = await api.matrix.get(projectId);
      setMatrixData(data);
    } catch {
      // silently fail — matrix may not exist yet
    }
  }, [projectId]);

  useEffect(() => {
    refreshMatrix();
  }, [refreshMatrix]);

  const updateCell = useCallback(
    (specId: string, reqKey: string, phaseId: number, status: MatrixStatus) => {
      const cellKey = `${specId}|${reqKey}|${phaseId}`;

      // Optimistic update
      setMatrixData(prev => {
        if (!prev) {
          return {
            project_id: projectId,
            matrix: { [specId]: { [reqKey]: { [String(phaseId)]: status } } },
            entries: [],
          };
        }
        const matrix = { ...prev.matrix };
        matrix[specId] = { ...(matrix[specId] ?? {}) };
        matrix[specId][reqKey] = { ...(matrix[specId][reqKey] ?? {}) };
        matrix[specId][reqKey][String(phaseId)] = status;
        return { ...prev, matrix };
      });

      // Debounced save
      const existing = debounceTimers.current.get(cellKey);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        setSaving(prev => new Set(prev).add(cellKey));
        try {
          await api.matrix.update(projectId, specId, reqKey, phaseId, status);
        } catch (err) {
          console.error('Failed to save matrix cell:', err);
        } finally {
          setSaving(prev => {
            const next = new Set(prev);
            next.delete(cellKey);
            return next;
          });
          debounceTimers.current.delete(cellKey);
        }
      }, 500);

      debounceTimers.current.set(cellKey, timer);
    },
    [projectId]
  );

  return { matrixData, saving, updateCell, refreshMatrix };
}
