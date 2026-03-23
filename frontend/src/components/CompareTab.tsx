import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Discipline } from '../types/setup';
import type { Phase } from '../types/project';
import type { CellSummary } from '../types/matrix';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CellStats {
  spec_count: number;
  total: number;
  required: number;
  optional: number;
  prohibited: number;
  enum_count: number;
}

interface CellInfo {
  discipline_id: number;
  phase_id: number;
  label: string;
  discipline_name: string;
  phase_name: string;
  header: Record<string, string>;
  stats: CellStats;
}

interface Overview {
  total_a: number;
  total_b: number;
  common: number;
  only_a: number;
  only_b: number;
  changed: number;
  identical: number;
  status_changes: number;
  value_changes: number;
}

interface CompareReq {
  signature: string;
  label: string;
  type: string;
  spec_name: string;
  status?: string;
  enum_values?: string[];
}

interface ChangedReq {
  signature: string;
  label: string;
  type: string;
  spec_name: string;
  status_a: string;
  status_b: string;
  enum_a: string[];
  enum_b: string[];
  status_changed: boolean;
  values_changed: boolean;
}

interface BySpec {
  spec_name: string;
  only_a: number;
  only_b: number;
  changed: number;
  identical: number;
}

interface SpecMetaField {
  field: string;
  value_a: string;
  value_b: string;
}

interface SpecMetaChange {
  spec_name: string;
  fields: SpecMetaField[];
}

interface CompareResult {
  cell_a: CellInfo;
  cell_b: CellInfo;
  overview: Overview;
  only_a: CompareReq[];
  only_b: CompareReq[];
  changed: ChangedReq[];
  identical: CompareReq[];
  status_changes: ChangedReq[];
  value_changes: ChangedReq[];
  by_spec: BySpec[];
  spec_meta_changes: SpecMetaChange[];
}

interface Props {
  projectId: number;
  disciplines: Discipline[];
  phases: Phase[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeColor(type: string): string {
  switch (type) {
    case 'property':       return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'attribute':      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'material':       return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'classification': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'partOf':         return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    case 'entity':         return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
    default:               return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function typeIcon(type: string): string {
  switch (type) {
    case 'property': return 'P';
    case 'attribute': return 'A';
    case 'material': return 'M';
    case 'classification': return 'C';
    case 'partOf': return 'PO';
    case 'entity': return 'E';
    default: return '?';
  }
}

function statusPill(status: string) {
  const cls =
    status === 'required'   ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' :
    status === 'optional'   ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
    status === 'prohibited' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                              'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{status}</span>;
}

function cellKey(discId: number, phaseId: number) { return `${discId}_${phaseId}`; }
function parseKey(key: string): [number, number] {
  const [d, p] = key.split('_').map(Number);
  return [d, p];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, accent, open, onToggle }: {
  title: string; count: number; accent: string; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-5 py-3 text-left rounded-xl border-2 ${accent} bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50`}
    >
      <div className="flex items-center gap-2.5">
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</span>
      </div>
      <span className={`text-xl font-bold ${count === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}`}>{count}</span>
    </button>
  );
}

function ReqRow({ r, side }: { r: CompareReq; side?: 'a' | 'b' }) {
  const sideColor = side === 'a' ? 'border-l-2 border-blue-300 dark:border-blue-700' :
                    side === 'b' ? 'border-l-2 border-green-300 dark:border-green-700' : '';
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800/40 ${sideColor}`}>
      <span className={`font-mono text-xs px-1 rounded flex-shrink-0 ${typeColor(r.type)}`}>{typeIcon(r.type)}</span>
      <span className="font-mono text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{r.label}</span>
      {r.status && statusPill(r.status)}
      {r.enum_values && r.enum_values.length > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono flex-shrink-0">
          {r.enum_values.slice(0, 2).join(', ')}{r.enum_values.length > 2 ? ` +${r.enum_values.length - 2}` : ''}
        </span>
      )}
      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 truncate max-w-[120px]">{r.spec_name}</span>
    </div>
  );
}

function CollapsibleSection({
  title, count, accent, defaultOpen = false, children,
}: {
  title: string; count: number; accent: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
      <SectionHeader title={title} count={count} accent={accent} open={open} onToggle={() => setOpen(v => !v)} />
      {open && count > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-2 space-y-0.5">
          {children}
        </div>
      )}
      {open && count === 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">None</p>
        </div>
      )}
    </div>
  );
}

function StatBar({ label, a, b, colorA, colorB }: {
  label: string; a: number; b: number; colorA: string; colorB: string;
}) {
  const max = Math.max(a, b, 1);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 text-right">{label}</span>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: colorA }} />
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(a / max) * 100}%`, background: colorA }} />
          </div>
          <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300 w-6 text-right">{a}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: colorB }} />
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(b / max) * 100}%`, background: colorB }} />
          </div>
          <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300 w-6 text-right">{b}</span>
        </div>
      </div>
    </div>
  );
}

// ── Shared table chrome ───────────────────────────────────────────────────────

function TableShell({ labelA, labelB, extraCols, children }: {
  labelA: string; labelB: string; extraCols?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 bg-gray-50/60 dark:bg-gray-800/30">
            <th className="px-4 py-2 text-left font-medium w-7">#</th>
            <th className="px-4 py-2 text-left font-medium">Requirement</th>
            <th className="px-4 py-2 text-left font-medium">Spec</th>
            {extraCols}
            <th className="px-4 py-2 text-left font-medium min-w-[150px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />{labelA}
              </span>
            </th>
            <th className="px-4 py-2 text-left font-medium min-w-[150px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />{labelB}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function ReqCell({ r }: { r: ChangedReq }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-mono text-xs px-1 rounded flex-shrink-0 ${typeColor(r.type)}`}>{typeIcon(r.type)}</span>
      <span className="font-mono text-gray-700 dark:text-gray-300 font-medium">{r.label}</span>
    </div>
  );
}

// ── 1. Spec metadata changes ──────────────────────────────────────────────────

function SpecMetaChangesTable({ changes, labelA, labelB }: {
  changes: SpecMetaChange[]; labelA: string; labelB: string;
}) {
  if (changes.length === 0) return <p className="text-xs text-gray-400 dark:text-gray-500 py-3 px-5">None</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 bg-gray-50/60 dark:bg-gray-800/30">
            <th className="px-4 py-2 text-left font-medium">Specification</th>
            <th className="px-4 py-2 text-left font-medium">Field</th>
            <th className="px-4 py-2 text-left font-medium min-w-[160px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />{labelA}</span>
            </th>
            <th className="px-4 py-2 text-left font-medium min-w-[160px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" />{labelB}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.flatMap((sc, si) =>
            sc.fields.map((f, fi) => {
              const even = (si + fi) % 2 === 0;
              return (
                <tr key={`${sc.spec_name}-${f.field}`}
                  className={`${even ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/40 dark:bg-gray-800/20'} border-b border-gray-50 dark:border-gray-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10`}>
                  {fi === 0 && (
                    <td rowSpan={sc.fields.length} className="px-4 py-2.5 font-mono text-indigo-700 dark:text-indigo-300 align-top border-r border-gray-100 dark:border-gray-800">
                      {sc.spec_name}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-medium">{f.field}</td>
                  <td className="px-4 py-2.5 bg-blue-50/50 dark:bg-blue-900/10">
                    {f.value_a
                      ? <span className="font-semibold text-gray-800 dark:text-gray-200">{f.value_a}</span>
                      : <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 bg-green-50/50 dark:bg-green-900/10">
                    {f.value_b
                      ? <span className="font-semibold text-gray-800 dark:text-gray-200">{f.value_b}</span>
                      : <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── 2. Status changes — compact, just status + enum count note ────────────────

function StatusChangesTable({ rows, labelA, labelB }: { rows: ChangedReq[]; labelA: string; labelB: string }) {
  if (rows.length === 0) return <p className="text-xs text-gray-400 dark:text-gray-500 py-3 px-5">None</p>;
  return (
    <TableShell labelA={labelA} labelB={labelB}>
      {rows.map((r, i) => {
        const even = i % 2 === 0;
        return (
          <tr key={r.signature}
            className={`${even ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/40 dark:bg-gray-800/20'} border-b border-gray-50 dark:border-gray-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10`}>
            <td className="px-4 py-2.5 text-gray-300 dark:text-gray-600 font-mono">{i + 1}</td>
            <td className="px-4 py-2.5"><ReqCell r={r} /></td>
            <td className="px-4 py-2.5 text-gray-400 dark:text-gray-500 truncate max-w-[110px]">{r.spec_name}</td>
            {/* Cell A — status bolded because it differs */}
            <td className="px-4 py-2.5 bg-blue-50/50 dark:bg-blue-900/10">
              <div className="space-y-1">
                <div className="font-bold">{statusPill(r.status_a)}</div>
                {r.enum_a.length > 0 && (
                  <span className="text-gray-400 dark:text-gray-500 font-mono">
                    {r.enum_a.length} enum value{r.enum_a.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </td>
            {/* Cell B */}
            <td className="px-4 py-2.5 bg-green-50/50 dark:bg-green-900/10">
              <div className="space-y-1">
                <div className="font-bold">{statusPill(r.status_b)}</div>
                {r.enum_b.length > 0 && (
                  <span className="text-gray-400 dark:text-gray-500 font-mono">
                    {r.enum_b.length} enum value{r.enum_b.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

// ── 3. Value/enum changes — full diff with colour-coded chips ─────────────────

function EnumDiffChips({ enumA, enumB, side }: { enumA: string[]; enumB: string[]; side: 'a' | 'b' }) {
  const setA = new Set(enumA);
  const setB = new Set(enumB);
  const values = side === 'a' ? enumA : enumB;
  if (values.length === 0) return <span className="italic text-gray-300 dark:text-gray-600 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map(v => {
        const inBoth = setA.has(v) && setB.has(v);
        const cls = inBoth
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'   // common → green
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';                  // unique → red
        return (
          <span key={v} className={`font-mono text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{v}</span>
        );
      })}
    </div>
  );
}

function ValueChangesTable({ rows, labelA, labelB }: { rows: ChangedReq[]; labelA: string; labelB: string }) {
  if (rows.length === 0) return <p className="text-xs text-gray-400 dark:text-gray-500 py-3 px-5">None</p>;
  return (
    <div className="space-y-1 px-2 py-1">
      {/* Legend */}
      <div className="flex items-center gap-4 px-2 pb-2">
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-block w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-800" /> Common value
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-block w-3 h-3 rounded bg-red-200 dark:bg-red-800" /> Unique to this cell
        </span>
      </div>
      <TableShell labelA={labelA} labelB={labelB}
        extraCols={<th className="px-4 py-2 text-left font-medium">Status</th>}>
        {rows.map((r, i) => {
          const even = i % 2 === 0;
          return (
            <tr key={r.signature}
              className={`${even ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/40 dark:bg-gray-800/20'} border-b border-gray-50 dark:border-gray-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10`}>
              <td className="px-4 py-2.5 text-gray-300 dark:text-gray-600 font-mono">{i + 1}</td>
              <td className="px-4 py-2.5"><ReqCell r={r} /></td>
              <td className="px-4 py-2.5 text-gray-400 dark:text-gray-500 truncate max-w-[110px]">{r.spec_name}</td>
              <td className="px-4 py-2.5">
                {/* same status or show both */}
                {r.status_a === r.status_b
                  ? statusPill(r.status_a)
                  : <span className="flex items-center gap-1">{statusPill(r.status_a)}<span className="text-gray-300">→</span>{statusPill(r.status_b)}</span>}
              </td>
              <td className="px-4 py-2.5 bg-blue-50/40 dark:bg-blue-900/10">
                <EnumDiffChips enumA={r.enum_a} enumB={r.enum_b} side="a" />
              </td>
              <td className="px-4 py-2.5 bg-green-50/40 dark:bg-green-900/10">
                <EnumDiffChips enumA={r.enum_a} enumB={r.enum_b} side="b" />
              </td>
            </tr>
          );
        })}
      </TableShell>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompareTab({ projectId, disciplines, phases }: Props) {
  const [summary, setSummary] = useState<CellSummary[]>([]);
  const [cellA, setCellA] = useState('');
  const [cellB, setCellB] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.matrix.summary(projectId).then(setSummary).catch(() => {});
  }, [projectId]);

  const nonEmptyCells = summary
    .filter(s => s.entry_count > 0)
    .map(s => {
      const disc  = disciplines.find(d => d.id === s.discipline_id);
      const phase = phases.find(p => p.id === s.phase_id);
      if (!disc || !phase) return null;
      return {
        key: cellKey(s.discipline_id, s.phase_id),
        label: `${disc.name} × ${phase.name}`,
        discipline_id: s.discipline_id,
        phase_id: s.phase_id,
      };
    })
    .filter(Boolean) as { key: string; label: string; discipline_id: number; phase_id: number }[];

  async function runCompare() {
    if (!cellA || !cellB || cellA === cellB) return;
    const [discA, phaseA] = parseKey(cellA);
    const [discB, phaseB] = parseKey(cellB);
    setLoading(true);
    setError(null);
    try {
      const data = await api.compareCells(projectId, discA, phaseA, discB, phaseB);
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? 'Comparison failed');
    } finally {
      setLoading(false);
    }
  }

  const canCompare = cellA && cellB && cellA !== cellB;

  return (
    <div className="space-y-6 pb-12">

      {/* ── Selector bar ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        {nonEmptyCells.length < 2 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            At least two non-empty matrix cells are required. Add requirements to the matrix first.
          </p>
        ) : (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-xs font-medium text-blue-600 dark:text-blue-400">Cell A</label>
              <select
                value={cellA}
                onChange={e => { setCellA(e.target.value); setResult(null); }}
                className="text-sm border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— choose —</option>
                {nonEmptyCells.map(c => (
                  <option key={c.key} value={c.key} disabled={c.key === cellB}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="text-sm font-bold text-gray-400 dark:text-gray-500 pb-2">vs</div>

            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-xs font-medium text-green-600 dark:text-green-400">Cell B</label>
              <select
                value={cellB}
                onChange={e => { setCellB(e.target.value); setResult(null); }}
                className="text-sm border border-green-300 dark:border-green-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">— choose —</option>
                {nonEmptyCells.map(c => (
                  <option key={c.key} value={c.key} disabled={c.key === cellA}>{c.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={runCompare}
              disabled={!canCompare || loading}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Comparing…' : 'Compare'}
            </button>
          </div>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!result && !loading && !error && (
        <div className="flex items-center justify-center h-40 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-sm text-gray-400 dark:text-gray-500">Select two matrix cells and click Compare.</p>
        </div>
      )}

      {result && !loading && (() => {
        const ov = result.overview;
        const ca = result.cell_a;
        const cb = result.cell_b;

        return (
          <div className="space-y-6">

            {/* ── Cell info cards ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {([['a', ca, '#3B82F6', 'border-blue-200 dark:border-blue-800'], ['b', cb, '#10B981', 'border-green-200 dark:border-green-800']] as const).map(([side, cell, color, border]) => (
                <div key={side} className={`bg-white dark:bg-gray-900 border-2 ${border} rounded-xl p-4 space-y-3`}>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {side.toUpperCase()}: {cell.label}
                    </span>
                  </div>
                  {cell.header?.title && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic truncate">{cell.header.title}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{cell.stats.spec_count}</div>
                      <div className="text-gray-400 dark:text-gray-500">specs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{cell.stats.total}</div>
                      <div className="text-gray-400 dark:text-gray-500">requirements</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-400 dark:text-gray-500 font-mono">{cell.stats.enum_count}</div>
                      <div className="text-gray-400 dark:text-gray-500">enum values</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="text-xs bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 px-2 py-0.5 rounded">
                      {cell.stats.required} required
                    </span>
                    {cell.stats.optional > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded">
                        {cell.stats.optional} optional
                      </span>
                    )}
                    {cell.stats.prohibited > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded">
                        {cell.stats.prohibited} prohibited
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Stats comparison bars ─────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Requirements comparison
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-3 h-3 rounded-sm" style={{ background: '#3B82F6' }} />
                <span className="text-xs text-gray-500 dark:text-gray-400">A: {ca.label}</span>
                <span className="w-3 h-3 rounded-sm ml-3" style={{ background: '#10B981' }} />
                <span className="text-xs text-gray-500 dark:text-gray-400">B: {cb.label}</span>
              </div>
              <div className="space-y-2.5">
                <StatBar label="Total" a={ov.total_a} b={ov.total_b} colorA="#3B82F6" colorB="#10B981" />
                <StatBar label="Required" a={ca.stats.required} b={cb.stats.required} colorA="#0D9488" colorB="#059669" />
                <StatBar label="Optional" a={ca.stats.optional} b={cb.stats.optional} colorA="#F59E0B" colorB="#D97706" />
                <StatBar label="Prohibited" a={ca.stats.prohibited} b={cb.stats.prohibited} colorA="#F87171" colorB="#EF4444" />
                <StatBar label="Enum values" a={ca.stats.enum_count} b={cb.stats.enum_count} colorA="#9CA3AF" colorB="#6B7280" />
              </div>
            </div>

            {/* ── Overview Venn ─────────────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Overlap overview
              </h3>
              <div className="flex items-center gap-6 flex-wrap">
                {/* Venn */}
                <svg viewBox="0 0 220 100" className="w-48 flex-shrink-0">
                  <circle cx="80"  cy="50" r="44" fill="#3B82F6" fillOpacity="0.15" stroke="#3B82F6" strokeWidth="1.5" />
                  <circle cx="140" cy="50" r="44" fill="#10B981" fillOpacity="0.15" stroke="#10B981" strokeWidth="1.5" />
                  <text x="52"  y="54" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#3B82F6">{ov.only_a}</text>
                  <text x="110" y="54" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#6B7280">{ov.common}</text>
                  <text x="168" y="54" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#10B981">{ov.only_b}</text>
                  <text x="52"  y="68" textAnchor="middle" fontSize="8" fill="#3B82F6">only A</text>
                  <text x="110" y="68" textAnchor="middle" fontSize="8" fill="#6B7280">common</text>
                  <text x="168" y="68" textAnchor="middle" fontSize="8" fill="#10B981">only B</text>
                </svg>
                {/* Stacked bar */}
                <div className="flex-1 min-w-[180px] space-y-2">
                  {(ov.only_a + ov.common + ov.only_b) > 0 && (
                    <div className="flex h-4 rounded-full overflow-hidden gap-px" title="Requirement overlap">
                      {ov.only_a > 0 && <div className="bg-blue-400" style={{ flex: ov.only_a }} />}
                      {ov.common > 0 && <div className="bg-gray-400" style={{ flex: ov.common }} />}
                      {ov.only_b > 0 && <div className="bg-green-400" style={{ flex: ov.only_b }} />}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 dark:text-blue-400">Only in A</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{ov.only_a}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-green-600 dark:text-green-400">Only in B</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{ov.only_b}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Common</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300">{ov.common}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-orange-600 dark:text-orange-400">Changed</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">{ov.changed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Identical</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300">{ov.identical}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-violet-600 dark:text-violet-400">Status changes</span>
                      <span className="font-bold text-violet-600 dark:text-violet-400">{ov.status_changes}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Only in A ─────────────────────────────────────────────── */}
            <CollapsibleSection
              title={`Only in A — ${ca.label}`}
              count={ov.only_a}
              accent="border-blue-200 dark:border-blue-800"
              defaultOpen={ov.only_a > 0}
            >
              {result.only_a.map(r => <ReqRow key={r.signature} r={r} side="a" />)}
            </CollapsibleSection>

            {/* ── Only in B ─────────────────────────────────────────────── */}
            <CollapsibleSection
              title={`Only in B — ${cb.label}`}
              count={ov.only_b}
              accent="border-green-200 dark:border-green-800"
              defaultOpen={ov.only_b > 0}
            >
              {result.only_b.map(r => <ReqRow key={r.signature} r={r} side="b" />)}
            </CollapsibleSection>

            {/* ── Spec metadata changes ─────────────────────────────────── */}
            <CollapsibleSection
              title="Specification metadata changes"
              count={result.spec_meta_changes.length}
              accent="border-indigo-200 dark:border-indigo-800"
              defaultOpen={result.spec_meta_changes.length > 0}
            >
              <SpecMetaChangesTable changes={result.spec_meta_changes} labelA={ca.label} labelB={cb.label} />
            </CollapsibleSection>

            {/* ── Status changes ────────────────────────────────────────── */}
            <CollapsibleSection
              title="Status changes"
              count={ov.status_changes}
              accent="border-violet-200 dark:border-violet-800"
              defaultOpen={ov.status_changes > 0}
            >
              <StatusChangesTable rows={result.status_changes} labelA={ca.label} labelB={cb.label} />
            </CollapsibleSection>

            {/* ── Value / enum changes ──────────────────────────────────── */}
            <CollapsibleSection
              title="Value / enum changes"
              count={ov.value_changes}
              accent="border-cyan-200 dark:border-cyan-800"
              defaultOpen={ov.value_changes > 0}
            >
              <ValueChangesTable rows={result.value_changes} labelA={ca.label} labelB={cb.label} />
            </CollapsibleSection>

            {/* ── Identical ─────────────────────────────────────────────── */}
            <CollapsibleSection
              title="Identical requirements"
              count={ov.identical}
              accent="border-gray-200 dark:border-gray-700"
            >
              {result.identical.map(r => <ReqRow key={r.signature} r={r} />)}
            </CollapsibleSection>

            {/* ── By specification ──────────────────────────────────────── */}
            {result.by_spec.length > 0 && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    By specification
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500">
                        <th className="px-5 py-2 text-left font-medium">Specification</th>
                        <th className="px-3 py-2 text-right font-medium text-blue-500">Only A</th>
                        <th className="px-3 py-2 text-right font-medium text-green-500">Only B</th>
                        <th className="px-3 py-2 text-right font-medium text-orange-500">Changed</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-400">Identical</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.by_spec.map((s, i) => (
                        <tr key={s.spec_name} className={`${i % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''} hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10`}>
                          <td className="px-5 py-2 font-mono text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{s.spec_name}</td>
                          <td className="px-3 py-2 text-right font-bold text-blue-600 dark:text-blue-400">{s.only_a || '—'}</td>
                          <td className="px-3 py-2 text-right font-bold text-green-600 dark:text-green-400">{s.only_b || '—'}</td>
                          <td className="px-3 py-2 text-right font-bold text-orange-600 dark:text-orange-400">{s.changed || '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-400 dark:text-gray-500">{s.identical || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        );
      })()}
    </div>
  );
}
