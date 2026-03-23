export interface LCAEntry {
  id: number;
  project_id: number;
  phase_id: number | null;
  discipline_id: number | null;
  ifc_entity: string;
  element_name: string;
  quantity_value: number;
  quantity_unit: string;
  material: string;
  bsdd_uri: string;
  gwp_factor: number;
  mass_kg: number;
  gwp_a1a3: number;
  gwp_a4a5: number | null;
  gwp_b1b7: number | null;
  gwp_c1c4: number | null;
  gwp_d: number | null;
  en15978_scope: string;
  confidence: 'order_of_magnitude' | 'indicative' | 'detailed' | 'certified';
  flag: 'ok' | 'warn' | 'error';
  stage_check: string;
}

export interface DisciplineStageBreakdown {
  code: string;
  name: string;
  color: string;
  stages: Record<string, number | null>;
}

export interface LCASummary {
  ils17_mass_kg: number;
  ils18_gwp_a1a3: number;
  ils19_wlc_estimate: number;
  confidence: string;
  loin_level: number;
  en15978_stages: Record<string, number | null>;
  by_discipline: Array<{ code: string; name: string; color: string; gwp_a1a3: number; mass_kg: number }>;
  /** Per-discipline GWP by EN 15978 stage group (from summed LCA entries). */
  by_discipline_stages?: DisciplineStageBreakdown[];
  by_riba_phase: Array<{ phase_code: string; phase_name: string; gwp_total: number | null; confidence: string | null }>;
  top_contributor: { element_name: string; gwp_a1a3: number; discipline: string } | null;
}

// --- LCA Check Engine types ---

export interface ElementCheck {
  element_id: string;
  element_name: string;
  ifc_entity: string;
  discipline: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  flags: string[];
  has_material: boolean;
  has_quantity: boolean;
  has_bsdd_uri: boolean;
  has_gwp_factor: boolean;
  unit_consistent: boolean;
  stages_available: string[];
  stages_projected: string[];
  stages_locked: string[];
  gwp_a1a3: number | null;
  gwp_total_available: number | null;
  confidence: string;
  material: string;
  quantity_value: number;
  quantity_unit: string;
  bsdd_uri: string;
  gwp_factor: number;
  mass_kg: number;
  gwp_a4a5: number | null;
}

export interface DisciplineBreakdown {
  gwp_a1a3: number;
  gwp_a4a5: number;
  mass_kg: number;
  pass_count: number;
  warn_count: number;
  fail_count: number;
  color: string;
}

export interface LCACheckResult {
  id?: number;
  project_id: number;
  phase_id: number;
  phase_name: string;
  phase_gate: string;
  loin_level: number;
  checked_at: string;
  total_elements: number;
  pass_count: number;
  warn_count: number;
  fail_count: number;
  skip_count: number;
  total_gwp_a1a3: number;
  total_gwp_a4a5: number;
  total_gwp_wlc: number;
  total_mass_kg: number;
  by_discipline: Record<string, DisciplineBreakdown>;
  by_stage: Record<string, number | null>;
  by_entity_type: Record<string, { gwp: number; count: number }>;
  elements: ElementCheck[];
}

export interface LCACheckRunSummary {
  id: number;
  project_id: number;
  phase_id: number;
  run_at: string;
  status: string;
  total_elements: number;
  pass_count: number;
  warn_count: number;
  fail_count: number;
  skip_count: number;
  total_gwp_a1a3: number;
  total_gwp_wlc: number;
  total_mass_kg: number;
  loin_level: number;
  confidence: string;
}
