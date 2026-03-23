import type { Discipline } from '../types/setup';
import type { IDSSource } from '../types/sources';
import type { CellSummary, CellData, CellHeader } from '../types/matrix';
import type { Project, Phase } from '../types/project';
import type { ValidationRun, IFCFileInfo, CellValidation } from '../types/validation';
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

  phases: {
    list: (projectId: number) => request<Phase[]>(`/api/projects/${projectId}/phases`),
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

  disciplines: {
    list: (projectId: number) => request<Discipline[]>(`/api/projects/${projectId}/disciplines`),
    add: (projectId: number, data: { name: string; abbreviation?: string; color?: string; order_index?: number }) =>
      request<Discipline>(`/api/projects/${projectId}/disciplines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (projectId: number, did: number, data: Partial<Discipline>) =>
      request<Discipline>(`/api/projects/${projectId}/disciplines/${did}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    delete: (projectId: number, did: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/disciplines/${did}`, { method: 'DELETE' }),
  },

  sources: {
    list: (projectId: number) => request<IDSSource[]>(`/api/projects/${projectId}/sources`),
    upload: (projectId: number, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<IDSSource>(`/api/projects/${projectId}/sources`, { method: 'POST', body: form });
    },
    get: (projectId: number, sid: number) => request<IDSSource>(`/api/projects/${projectId}/sources/${sid}`),
    delete: (projectId: number, sid: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/sources/${sid}`, { method: 'DELETE' }),
  },

  matrix: {
    summary: (projectId: number) => request<CellSummary[]>(`/api/projects/${projectId}/matrix`),
    getCell: (projectId: number, did: number, pid: number) =>
      request<CellData>(`/api/projects/${projectId}/matrix/${did}/${pid}`),
    updateHeader: (projectId: number, did: number, pid: number, header: CellHeader) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/matrix/${did}/${pid}/header`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(header),
      }),
    drop: (projectId: number, did: number, pid: number, payload: any) =>
      request<{ ok: boolean; group_key: string; entries_added: number }>(`/api/projects/${projectId}/matrix/${did}/${pid}/drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    updateStatus: (projectId: number, eid: number, status: string) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/matrix/entries/${eid}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    updateEntryValues: (projectId: number, eid: number, values: string[]) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/matrix/entries/${eid}/values`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      }),
    updateSpecMeta: (projectId: number, did: number, pid: number, specName: string, meta: { identifier: string; description: string; instructions: string; ifc_version: string }) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/matrix/${did}/${pid}/spec-meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec_name: specName, ...meta }),
      }),
    deleteEntry: (projectId: number, eid: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/matrix/entries/${eid}`, { method: 'DELETE' }),
    deleteGroup: (projectId: number, gkey: string) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/matrix/entries/group/${gkey}`, { method: 'DELETE' }),
    clearCell: (projectId: number, did: number, pid: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/matrix/${did}/${pid}`, { method: 'DELETE' }),
  },

  export: {
    cellUrl: (projectId: number, did: number, pid: number) => `${BASE}/api/projects/${projectId}/export/cell/${did}/${pid}`,
    disciplineUrl: (projectId: number, did: number) => `${BASE}/api/projects/${projectId}/export/discipline/${did}`,
    phaseUrl: (projectId: number, pid: number) => `${BASE}/api/projects/${projectId}/export/phase/${pid}`,
    allUrl: (projectId: number) => `${BASE}/api/projects/${projectId}/export/all`,
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
    get: (projectId: number) => request<any>(`/api/projects/${projectId}/ids`),
  },

  ifc: {
    upload: (projectId: number, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<IFCFileInfo>(`/api/projects/${projectId}/upload-ifc`, { method: 'POST', body: form });
    },
    info: (projectId: number) => request<IFCFileInfo>(`/api/projects/${projectId}/ifc-info`),
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

  compareCells: (projectId: number, params: {
    discA?: number; phaseA?: number;
    discB?: number; phaseB?: number;
    sourceA?: number; sourceB?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.discA   != null) q.set('disc_a',   String(params.discA));
    if (params.phaseA  != null) q.set('phase_a',  String(params.phaseA));
    if (params.discB   != null) q.set('disc_b',   String(params.discB));
    if (params.phaseB  != null) q.set('phase_b',  String(params.phaseB));
    if (params.sourceA != null) q.set('source_a', String(params.sourceA));
    if (params.sourceB != null) q.set('source_b', String(params.sourceB));
    return request<any>(`/api/projects/${projectId}/compare-cells?${q}`);
  },

  cellValidation: {
    list: (projectId: number, ifcFileId?: number) => {
      const q = ifcFileId ? `?ifc_file_id=${ifcFileId}` : '';
      return request<CellValidation[]>(`/api/projects/${projectId}/cell-validations${q}`);
    },
    get: (projectId: number, vid: number) =>
      request<CellValidation>(`/api/projects/${projectId}/cell-validations/${vid}`),
    start: (projectId: number, body: { ifc_file_id: number; discipline_id: number; phase_id: number }) =>
      request<CellValidation>(`/api/projects/${projectId}/cell-validations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    delete: (projectId: number, vid: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/cell-validations/${vid}`, { method: 'DELETE' }),
    bcfUrl: (projectId: number, vid: number) =>
      `${BASE}/api/projects/${projectId}/cell-validations/${vid}/bcf`,
  },

  ifcFiles: {
    list: (projectId: number) =>
      request<IFCFileInfo[]>(`/api/projects/${projectId}/ifc-files`),
    upload: (projectId: number, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<IFCFileInfo>(`/api/projects/${projectId}/upload-ifc`, { method: 'POST', body: form });
    },
    delete: (projectId: number, fid: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/ifc-files/${fid}`, { method: 'DELETE' }),
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
};
