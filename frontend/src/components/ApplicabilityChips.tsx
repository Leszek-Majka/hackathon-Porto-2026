import React from 'react';

interface Chip {
  label: string;
  color: string;
  title?: string;
}

function val(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v.value) return String(v.value);
  if (v.values) return v.values.join(' | ');
  if (v.pattern) return `~${v.pattern}`;
  return '';
}

function buildChips(applicability: Record<string, any>): Chip[] {
  const chips: Chip[] = [];
  if (!applicability) return chips;

  // entity
  const entity = applicability.entity;
  if (entity) {
    const name = val(entity.name);
    const predef = val(entity.predefinedType);
    if (name) {
      chips.push({
        label: predef ? `${name} · ${predef}` : name,
        color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
        title: 'Entity filter',
      });
    }
  }

  // partOf
  const partOf = applicability.partOf;
  if (partOf) {
    const entityName = val(partOf.entity?.name);
    const rel = partOf.relation ?? '';
    const relShort = rel.replace('IfcRel', '');
    chips.push({
      label: entityName ? `partOf ${entityName}` : `partOf (${relShort})`,
      color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      title: rel || 'Part-of filter',
    });
  }

  // properties
  const properties: any[] = applicability.properties ?? [];
  for (const p of properties) {
    const ps = val(p.propertySet);
    const bn = val(p.baseName);
    const v = val(p.value);
    const label = ps && bn ? `${ps}.${bn}` : bn || ps || 'Property';
    chips.push({
      label: v ? `${label} = ${v}` : label,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      title: 'Property filter',
    });
  }

  // attributes
  const attributes: any[] = applicability.attributes ?? [];
  for (const a of attributes) {
    const name = val(a.name);
    const v = val(a.value);
    chips.push({
      label: v ? `${name} = ${v}` : name || 'Attribute',
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      title: 'Attribute filter',
    });
  }

  // material
  const material = applicability.material;
  if (material) {
    const v = val(material.value);
    chips.push({
      label: v ? `material: ${v}` : 'Material',
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      title: 'Material filter',
    });
  }

  // classifications
  const classifications: any[] = applicability.classifications ?? [];
  for (const c of classifications) {
    const sys = val(c.system);
    const v = val(c.value);
    const label = sys && v ? `${sys} / ${v}` : v || sys || 'Classification';
    chips.push({
      label,
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      title: 'Classification filter',
    });
  }

  return chips;
}

interface Props {
  applicability: Record<string, any>;
  /** 'browser' = compact inline row, 'entry' = slightly smaller */
  variant?: 'browser' | 'entry';
}

export default function ApplicabilityChips({ applicability, variant = 'browser' }: Props) {
  const chips = buildChips(applicability);
  if (chips.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${variant === 'entry' ? 'mt-0.5' : 'mt-1 mb-1'}`}>
      {chips.map((chip, i) => (
        <span
          key={i}
          title={chip.title}
          className={`font-mono text-xs px-1.5 py-0.5 rounded ${chip.color}`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}
