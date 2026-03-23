export interface Discipline {
  id: number;
  project_id: number;
  name: string;
  abbreviation: string;
  code?: string;
  color: string;
  order_index: number;
}

export interface Phase {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  color: string;
  order_index: number;
  created_at: string;
}
