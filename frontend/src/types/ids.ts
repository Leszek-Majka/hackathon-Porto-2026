export interface IDSInfo {
  title?: string;
  copyright?: string;
  version?: string;
  description?: string;
  author?: string;
  date?: string;
  purpose?: string;
}

export interface ValueConstraint {
  type: 'simpleValue' | 'enumeration' | 'pattern' | 'restriction';
  value?: string;
  values?: string[];
  base?: string;
}

export interface IDSRequirement {
  key: string;
  type: 'attribute' | 'property' | 'material' | 'classification' | 'partOf';
  minOccurs: string;
  cardinality: string;
  baseStatus: 'required' | 'optional';
  instructions?: string;
  // attribute
  name?: ValueConstraint | null;
  value?: ValueConstraint | null;
  // property
  propertySet?: ValueConstraint | null;
  baseName?: ValueConstraint | null;
  dataType?: ValueConstraint | null;
  // classification
  system?: ValueConstraint | null;
  // partOf
  relation?: string;
  entity?: Record<string, ValueConstraint | null>;
}

export interface IDSSpecification {
  id: string;
  name: string;
  ifcVersion: string;
  description?: string;
  instructions?: string;
  applicability: Record<string, unknown>;
  requirements: IDSRequirement[];
}

export interface IDSParsed {
  info: IDSInfo;
  specifications: IDSSpecification[];
}
