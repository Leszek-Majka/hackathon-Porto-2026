export type MatrixStatus = 'required' | 'optional' | 'excluded';

export interface Phase {
  id: number;
  project_id: number;
  name: string;
  color: string;
  order_index: number;
  created_at: string;
}

export interface IDSFileInfo {
  id: number;
  project_id: number;
  filename: string;
  parsed_json: string;
  uploaded_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  ids_file?: IDSFileInfo | null;
  phases: Phase[];
  spec_count?: number;
  phase_count?: number;
}

export interface MatrixEntry {
  id: number;
  project_id: number;
  spec_id: string;
  requirement_key: string;
  phase_id: number;
  status: MatrixStatus;
}

export interface MatrixData {
  project_id: number;
  matrix: Record<string, Record<string, Record<string, MatrixStatus>>>;
  entries: MatrixEntry[];
}

export interface AutoFillResponse {
  dry_run: boolean;
  matched_specs: number;
  matched_requirements: number;
  updated_cells: number;
  preview: AutoFillPreviewSpec[];
  error: string | null;
}

export interface AutoFillPreviewSpec {
  spec_name: string;
  surviving_requirements: AutoFillPreviewReq[];
}

export interface AutoFillPreviewReq {
  type: string;
  name?: string;
  baseName?: string;
  propertySet?: string;
  value?: string;
}
