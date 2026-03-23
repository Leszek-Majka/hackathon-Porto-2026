export interface CellSummary {
  discipline_id: number;
  phase_id: number;
  entry_count: number;
  spec_count: number;
  enum_count: number;
  optional_count: number;
  prohibited_count: number;
}

export interface SpecMeta {
  identifier: string;
  description: string;
  instructions: string;
  ifc_version: string;
}

export interface CellEntry {
  id: number;
  cell_id: number;
  source_ids_id: number | null;
  entry_type: string;
  spec_name: string;
  applicability: any[];
  requirement: any;
  status: 'required' | 'optional' | 'prohibited';
  group_key: string;
  group_type: string;
  order_index: number;
  spec_meta: SpecMeta;
}

export interface CellHeader {
  title: string;
  author: string;
  date: string;
  version: string;
  description: string;
  copyright: string;
  purpose: string;
  milestone: string;
}

export interface CellData {
  id?: number;
  discipline_id: number;
  phase_id: number;
  header: CellHeader;
  entries: CellEntry[];
}

export interface DropPayload {
  sourceIdsId: number;
  dropType: 'specification' | 'applicability' | 'requirement' | 'ids' | 'multi_specification';
  specName: string;
  specNames?: string[];          // for multi_specification
  applicabilityIndex: number | null;
  requirementIndex: number | null;
  valueOverride?: string;        // for single enum value drops
}
