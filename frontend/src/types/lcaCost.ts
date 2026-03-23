export interface LcaCostAssembly {
  global_id: string;
  name: string;
  type: string;
  volume_m3: number;
  gwp_kgco2e_m3: number;
  cost_capital: number;
  cost_maint_annual: number;
  replacement_year: number | null;
  replacement_pct: number;
  energy_impact_kwh: number;
  material: string;
}

export interface LcaCostProjection {
  year: number;
  capital: number;
  maintenance: number;
  replacement: number;
  energy: number;
  total_cost: number;
  total_cost_pv: number;
  cum_cost: number;
  carbon_kg: number;
  carbon_t: number;
  cum_carbon: number;
  carbon_cost: number;
  carbon_cost_pv: number;
  cum_carbon_cost: number;
}

export interface LcaCostParams {
  study_period: number;
  discount_rate: number;
  energy_escalation: number;
  carbon_price: number;
  grid_factor: number;
}

export interface LcaCostData {
  id?: number;
  assemblies: LcaCostAssembly[];
  projections: LcaCostProjection[];
  params: LcaCostParams;
  computed_at: string | null;
}
