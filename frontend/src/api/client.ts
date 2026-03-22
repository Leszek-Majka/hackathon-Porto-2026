import type { Project, Phase, MatrixData, MatrixStatus } from '../types/project';
import type { IDSParsed } from '../types/ids';

const BASE = 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// Projects
export const api = {
  projects: {
    list: () => request<Project[]>('/api/projects'),
    get: (id: number) => request<Project>(`/api/projects/${id}`),
    create: (name: string, description?: string) =>
      request<Project>('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description ?? '' }),
      }),
    delete: (id: number) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  },

  ids: {
    upload: (projectId: number, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<{ id: number; filename: string; parsed_json: string }>(
        `/api/projects/${projectId}/upload`,
        { method: 'POST', body: form }
      );
    },
    get: (projectId: number) => request<IDSParsed>(`/api/projects/${projectId}/ids`),
  },

  phases: {
    add: (projectId: number, name: string, color?: string, orderIndex?: number) =>
      request<Phase>(`/api/projects/${projectId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, order_index: orderIndex ?? 0 }),
      }),
    update: (projectId: number, phaseId: number, data: Partial<{ name: string; color: string; order_index: number }>) =>
      request<Phase>(`/api/projects/${projectId}/phases/${phaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    delete: (projectId: number, phaseId: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/phases/${phaseId}`, { method: 'DELETE' }),
  },

  matrix: {
    get: (projectId: number) => request<MatrixData>(`/api/projects/${projectId}/matrix`),
    update: (projectId: number, specId: string, reqKey: string, phaseId: number, status: MatrixStatus) =>
      request<MatrixEntry>(`/api/projects/${projectId}/matrix`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec_id: specId, requirement_key: reqKey, phase_id: phaseId, status }),
      }),
  },

  export: {
    phase: (projectId: number, phaseId: number) =>
      `${BASE}/api/projects/${projectId}/export/${phaseId}`,
    all: (projectId: number) =>
      `${BASE}/api/projects/${projectId}/export`,
  },
};

// re-export type for convenience
type MatrixEntry = import('../types/project').MatrixEntry;
