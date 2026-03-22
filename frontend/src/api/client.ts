import type { Project, Phase, MatrixData, MatrixStatus } from '../types/project';
import type { IDSParsed } from '../types/ids';
import type { ValidationRun, IFCFileInfo } from '../types/validation';
import type { DashboardData } from '../types/dashboard';
import type { Translation, ProjectLanguage } from '../types/translations';

const BASE = 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

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

  ifc: {
    upload: (projectId: number, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<IFCFileInfo>(`/api/projects/${projectId}/upload-ifc`, { method: 'POST', body: form });
    },
    info: (projectId: number) => request<IFCFileInfo>(`/api/projects/${projectId}/ifc-info`),
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

  validation: {
    start: (projectId: number, phaseId: number) =>
      request<{ run_id: number; status: string }>(`/api/projects/${projectId}/validate/${phaseId}`, { method: 'POST' }),
    list: (projectId: number) => request<ValidationRun[]>(`/api/projects/${projectId}/validations`),
    get: (projectId: number, runId: number) => request<ValidationRun>(`/api/projects/${projectId}/validations/${runId}`),
    delete: (projectId: number, runId: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/validations/${runId}`, { method: 'DELETE' }),
  },

  dashboard: {
    get: (projectId: number) => request<DashboardData>(`/api/projects/${projectId}/dashboard`),
    reportUrl: (projectId: number, phaseId?: number, lang?: string) => {
      const params = new URLSearchParams();
      if (phaseId) params.set('phase_id', String(phaseId));
      if (lang) params.set('lang', lang);
      return `${BASE}/api/projects/${projectId}/report/pdf?${params}`;
    },
  },

  translations: {
    list: (projectId: number) => request<Translation[]>(`/api/projects/${projectId}/translations`),
    upsert: (projectId: number, data: Omit<Translation, 'id' | 'project_id' | 'updated_at'>) =>
      request<Translation>(`/api/projects/${projectId}/translations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    delete: (projectId: number, id: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/translations/${id}`, { method: 'DELETE' }),
    languages: (projectId: number) => request<ProjectLanguage[]>(`/api/projects/${projectId}/languages`),
    updateLanguages: (projectId: number, updates: { code: string; enabled: boolean }[]) =>
      request<ProjectLanguage[]>(`/api/projects/${projectId}/languages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }),
  },

  export: {
    phase: (projectId: number, phaseId: number, lang = 'en') =>
      `${BASE}/api/projects/${projectId}/export/${phaseId}?lang=${lang}`,
    all: (projectId: number) =>
      `${BASE}/api/projects/${projectId}/export`,
  },
};

type MatrixEntry = import('../types/project').MatrixEntry;
