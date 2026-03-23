import React, { useState } from 'react';
import type { LCAEntry, ElementCheck } from '../../types/lca';
import type { Discipline } from '../../types/setup';
import { STAGE_CHECK_LABELS, confidenceLabel } from './lcaLabels';

interface Props {
  // Accept either check elements or legacy entries
  elements?: ElementCheck[];
  entries?: LCAEntry[];
  disciplines: Discipline[];
}

type SortKey = 'element_name' | 'quantity_value' | 'mass_kg' | 'gwp_factor' | 'gwp_a1a3' | 'gwp_a4a5' | 'status';

interface NormalizedRow {
  id: string;
  element_name: string;
  ifc_entity: string;
  discipline: string;
  discipline_id?: number | null;
  quantity_value: number;
  quantity_unit: string;
  material: string;
  bsdd_uri: string;
  gwp_factor: number;
  gwp_a1a3: number | null;
  gwp_a4a5: number | null;
  mass_kg: number;
  status: 'pass' | 'warn' | 'fail' | 'skip' | 'ok' | 'error';
  confidence: string;
  flags: string[];
  stages_available?: string[];
  stages_projected?: string[];
  stages_locked?: string[];
  en15978_scope?: string;
  stage_check?: string;
  has_material?: boolean;
  has_quantity?: boolean;
  has_bsdd_uri?: boolean;
  has_gwp_factor?: boolean;
  unit_consistent?: boolean;
}

function normalizeRows(elements?: ElementCheck[], entries?: LCAEntry[], discMap?: Record<number, Discipline>): NormalizedRow[] {
  if (elements && elements.length > 0) {
    return elements.map(e => ({
      id: e.element_id,
      element_name: e.element_name,
      ifc_entity: e.ifc_entity,
      discipline: e.discipline,
      quantity_value: e.quantity_value,
      quantity_unit: e.quantity_unit,
      material: e.material,
      bsdd_uri: e.bsdd_uri,
      gwp_factor: e.gwp_factor,
      gwp_a1a3: e.gwp_a1a3,
      gwp_a4a5: e.gwp_a4a5 ?? null,
      mass_kg: e.mass_kg,
      status: e.status,
      confidence: e.confidence,
      flags: e.flags,
      stages_available: e.stages_available,
      stages_projected: e.stages_projected,
      stages_locked: e.stages_locked,
      has_material: e.has_material,
      has_quantity: e.has_quantity,
      has_bsdd_uri: e.has_bsdd_uri,
      has_gwp_factor: e.has_gwp_factor,
      unit_consistent: e.unit_consistent,
    }));
  }
  if (entries && entries.length > 0) {
    return entries.map(e => {
      const disc = e.discipline_id && discMap ? discMap[e.discipline_id] : null;
      return {
        id: String(e.id),
        element_name: e.element_name,
        ifc_entity: e.ifc_entity,
        discipline: disc?.code ?? disc?.abbreviation ?? '',
        discipline_id: e.discipline_id,
        quantity_value: e.quantity_value,
        quantity_unit: e.quantity_unit,
        material: e.material,
        bsdd_uri: e.bsdd_uri,
        gwp_factor: e.gwp_factor,
        gwp_a1a3: e.gwp_a1a3,
        gwp_a4a5: e.gwp_a4a5,
        mass_kg: e.mass_kg,
        status: e.flag,
        confidence: e.confidence,
        flags: [],
        en15978_scope: e.en15978_scope,
        stage_check: e.stage_check,
      };
    });
  }
  return [];
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(n < 10 ? 3 : 0);
}

function statusDot(status: string) {
  const colors: Record<string, string> = {
    pass: 'bg-green-500',
    ok: 'bg-green-500',
    warn: 'bg-amber-500',
    fail: 'bg-red-500 animate-pulse',
    error: 'bg-red-500 animate-pulse',
    skip: 'bg-gray-500',
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] ?? 'bg-gray-500'}`} />
  );
}

function safeStageCheck(raw?: string): Record<string, boolean> {
  try {
    const o = JSON.parse(raw || '{}') as Record<string, boolean>;
    return typeof o === 'object' && o !== null ? o : {};
  } catch {
    return {};
  }
}

function statusSortOrder(s: string): number {
  if (s === 'fail' || s === 'error') return 0;
  if (s === 'warn') return 1;
  if (s === 'pass' || s === 'ok') return 2;
  return 3;
}

export default function LCAElementsTable({ elements, entries, disciplines }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const discMap = Object.fromEntries(disciplines.map(d => [d.id, d]));
  const discColorMap = Object.fromEntries(disciplines.map(d => [d.code ?? d.abbreviation ?? '', d.color]));

  const rows = normalizeRows(elements, entries, discMap);

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'status') {
      const diff = statusSortOrder(a.status) - statusSortOrder(b.status);
      return sortAsc ? diff : -diff;
    }
    const va = a[sortKey as keyof NormalizedRow] ?? 0;
    const vb = b[sortKey as keyof NormalizedRow] ?? 0;
    if (typeof va === 'string' && typeof vb === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'status'); }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totals = {
    mass_kg: rows.reduce((s, e) => s + (e.mass_kg || 0), 0),
    gwp_a1a3: rows.reduce((s, e) => s + (e.gwp_a1a3 || 0), 0),
    gwp_a4a5: rows.reduce((s, e) => s + (e.gwp_a4a5 || 0), 0),
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none whitespace-nowrap"
      onClick={() => toggleSort(k)}
    >
      {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <SortHeader k="status" label="Status" />
              <SortHeader k="element_name" label="Element" />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">IFC Entity</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Discipline</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Material</th>
              <SortHeader k="quantity_value" label="Qty" />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Unit</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">bsDD URI</th>
              <SortHeader k="gwp_factor" label="GWP Factor" />
              <SortHeader k="gwp_a1a3" label="GWP A1-A3" />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Confidence</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Flags</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(e => {
              const isExpanded = expanded.has(e.id);
              const discColor = discColorMap[e.discipline] || '#888';
              return (
                <React.Fragment key={e.id}>
                  <tr
                    className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => toggleExpand(e.id)}
                  >
                    <td className="px-3 py-2">{statusDot(e.status)}</td>
                    <td className="px-3 py-2 text-white font-mono text-xs">{e.element_name}</td>
                    <td className="px-3 py-2 text-gray-400 font-mono text-xs">{e.ifc_entity}</td>
                    <td className="px-3 py-2">
                      {e.discipline && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: discColor + '20', color: discColor }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: discColor }} />
                          {e.discipline}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{e.material}</td>
                    <td className="px-3 py-2 text-gray-300 font-mono text-xs">{formatNumber(e.quantity_value)}</td>
                    <td className="px-3 py-2 text-gray-400 font-mono text-xs">{e.quantity_unit}</td>
                    <td className="px-3 py-2 text-xs">
                      <a
                        href={e.bsdd_uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline truncate block max-w-[160px]"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {e.bsdd_uri ? '.../' + e.bsdd_uri.split('/').pop() : '—'}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-gray-300 font-mono text-xs">{e.gwp_factor}</td>
                    <td className="px-3 py-2 text-teal-400 font-mono text-xs font-semibold text-right">
                      {formatNumber(e.gwp_a1a3)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                        {e.confidence === 'order_of_magnitude' ? '±50%' :
                         e.confidence === 'indicative' ? '±30%' :
                         e.confidence === 'detailed' ? '±15%' : '±5%'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {e.flags.map((f, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-400"
                          >
                            {f.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-800/30">
                      <td colSpan={12} className="px-6 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-gray-500">Full bsDD URI:</span>
                            <a href={e.bsdd_uri} target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 hover:underline ml-1 break-all">{e.bsdd_uri || '—'}</a>
                          </div>
                          <div>
                            <span className="text-gray-500">Confidence:</span>
                            <span className="text-gray-300 ml-1">{confidenceLabel(e.confidence)}</span>
                          </div>
                          {e.en15978_scope && (
                            <div>
                              <span className="text-gray-500">EN 15978 scope:</span>
                              <span className="text-gray-300 ml-1 font-mono">{e.en15978_scope}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">Status:</span>
                            <span className="ml-1">{statusDot(e.status)}</span>
                            <span className="text-gray-300 ml-1">{e.status}</span>
                          </div>

                          {/* Check details (from ElementCheck) */}
                          {e.has_material !== undefined && (
                            <div className="md:col-span-2">
                              <span className="text-gray-500 block mb-1">Data completeness checks:</span>
                              <div className="flex flex-wrap gap-2">
                                <CheckBadge label="Material" ok={e.has_material} />
                                <CheckBadge label="Quantity" ok={e.has_quantity} />
                                <CheckBadge label="bsDD URI" ok={e.has_bsdd_uri} />
                                <CheckBadge label="GWP Factor" ok={e.has_gwp_factor} />
                                <CheckBadge label="Unit" ok={e.unit_consistent} />
                              </div>
                            </div>
                          )}

                          {/* Lifecycle stages */}
                          {(e.stages_available || e.stage_check) && (
                            <div className="md:col-span-2">
                              <span className="text-gray-500 block mb-1">Lifecycle stage coverage:</span>
                              {e.stages_available ? (
                                <div className="flex flex-wrap gap-1">
                                  {e.stages_available.map(s => (
                                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 font-mono">{s} LIVE</span>
                                  ))}
                                  {e.stages_projected?.map(s => (
                                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 font-mono">{s} PROJ</span>
                                  ))}
                                  {e.stages_locked?.map(s => (
                                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-mono">{s} LOCKED</span>
                                  ))}
                                </div>
                              ) : (
                                <ul className="list-disc list-inside text-gray-300 space-y-0.5">
                                  {Object.entries(safeStageCheck(e.stage_check)).map(([k, v]) => (
                                    <li key={k}>
                                      <span className="text-gray-400">{STAGE_CHECK_LABELS[k] ?? k}:</span>{' '}
                                      {v ? 'Included' : 'Not in scope'}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {/* Flag explanations */}
                          {e.flags.length > 0 && (
                            <div className="md:col-span-2">
                              <span className="text-gray-500 block mb-1">Flag details:</span>
                              <ul className="list-disc list-inside text-red-300 space-y-0.5">
                                {e.flags.map((f, i) => (
                                  <li key={i}>{f.replace(/_/g, ' ')}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {/* Totals row */}
            <tr className="border-t-2 border-gray-600 font-bold">
              <td />
              <td className="px-3 py-2 text-white text-xs">TOTAL</td>
              <td /><td /><td /><td /><td /><td /><td />
              <td className="px-3 py-2 text-teal-400 font-mono text-xs text-right">{formatNumber(totals.gwp_a1a3)}</td>
              <td /><td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckBadge({ label, ok }: { label: string; ok?: boolean }) {
  if (ok === undefined) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
      ok ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
    }`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}
