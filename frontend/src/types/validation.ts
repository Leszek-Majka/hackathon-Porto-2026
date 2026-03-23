export interface ValidationSummary {
  total_elements: number;
  passing_elements: number;
  failing_elements: number;
  pass_rate: number;
}

export interface FailingElement {
  element_id: string;
  element_type: string;
  element_name: string;
  global_id: string;
  failed_requirements: string[];
}

export interface SpecResult {
  spec_id: string;
  spec_name: string;
  elements_checked: number;
  elements_passing: number;
  failures: FailingElement[];
}

export interface ValidationRun {
  id: number;
  project_id: number;
  phase_id: number;
  ifc_file_id: number;
  status: 'pending' | 'running' | 'complete' | 'error';
  run_at: string;
  summary: ValidationSummary;
  error_message?: string;
  results?: { specs: SpecResult[] };
}

export interface IFCFileInfo {
  id: number;
  filename: string;
  ifc_schema: string;
  element_count: number;
  uploaded_at: string;
}

export interface CellValidationSummary {
  total_elements: number;
  passing_elements: number;
  failing_elements: number;
  pass_rate: number;
}

export interface CellSpecResult {
  spec_name: string;
  elements_checked: number;
  elements_passing: number;
  failures: FailingElement[];
}

export interface CellValidation {
  id: number;
  project_id: number;
  ifc_file_id: number;
  discipline_id: number;
  phase_id: number;
  status: 'pending' | 'running' | 'complete' | 'error';
  run_at: string;
  summary: CellValidationSummary;
  error_message: string;
  specs?: CellSpecResult[];
}
