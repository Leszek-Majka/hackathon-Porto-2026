export interface IDSSource {
  id: number;
  project_id: number;
  filename: string;
  title: string;
  author: string;
  date: string;
  version: string;
  description: string;
  copyright: string;
  purpose: string;
  milestone: string;
  spec_count: number;
  uploaded_at: string;
  parsed?: IDSParsed;
}

export interface IDSParsed {
  info: Record<string, string | null>;
  specifications: IDSSpec[];
}

export interface IDSSpec {
  id: string;
  name: string;
  ifcVersion: string;
  description: string;
  applicability: Record<string, any>;
  requirements: IDSRequirement[];
}

export interface IDSRequirement {
  key: string;
  type: string;
  baseStatus: string;
  minOccurs: string;
  name?: { type: string; value?: string };
  propertySet?: { type: string; value?: string };
  baseName?: { type: string; value?: string };
  value?: { type: string; value?: string };
  system?: { type: string; value?: string };
  relation?: string;
}
