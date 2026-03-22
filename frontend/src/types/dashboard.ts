export interface MetricCards {
  total_specs: number;
  total_requirements: number;
  phases_defined: number;
  latest_pass_rate: number | null;
  most_problematic_spec: string | null;
}

export interface MaturityChartEntry {
  phase: string;
  phase_id: number;
  color: string;
  required: number;
  optional: number;
  excluded: number;
}

export interface ProgressDataPoint {
  timestamp: string;
  pass_rate: number;
}

export interface ValidationProgressSeries {
  phase_id: number;
  phase_name: string;
  color: string;
  data: ProgressDataPoint[];
}

export interface HeatmapCell {
  phase_id: number;
  phase_name: string;
  pass_rate: number | null;
  run_id: number | null;
}

export interface HeatmapRow {
  spec_id: string;
  spec_name: string;
  cells: HeatmapCell[];
}

export interface DashboardData {
  metric_cards: MetricCards;
  maturity_chart: MaturityChartEntry[];
  validation_progress: ValidationProgressSeries[];
  heatmap: HeatmapRow[];
}
