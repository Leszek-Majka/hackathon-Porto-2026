import React, { useState } from 'react';
import { api } from '../api/client';
import type { IDSSource } from '../types/sources';

interface CompareReq {
  signature: string;
  label: string;
  type: string;
  spec_name: string;
}

interface CompareResult {
  source_a: { id: number; filename: string; title: string };
  source_b: { id: number; filename: string; title: string };
  stats: {
    total_a: number;
    total_b: number;
    common: number;
    only_a: number;
    only_b: number;
  };
  common: CompareReq[];
  only_a: CompareReq[];
  only_b: CompareReq[];
}

interface Props {
  projectId: number;
  sources: IDSSource[];
}

function typeColor(type: string): string {
  switch (type) {
    case 'property': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'attribute': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'material': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'classification': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function typeIcon(type: string): string {
  switch (type) {
    case 'property': return 'P';
    case 'attribute': return 'A';
    case 'material': return 'M';
    case 'classification': return 'C';
    default: return '?';
  }
}

function ReqList({ reqs }: { reqs: CompareReq[] }) {
  if (reqs.length === 0) return <p className="text-xs text-gray-400 dark:text-gray-500 py-2 px-1">None</p>;
  return (
    <div className="space-y-1 mt-2">
      {reqs.map(r => (
        <div key={r.signature} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <span className={`font-mono text-xs px-1 rounded flex-shrink-0 ${typeColor(r.type)}`}>
            {typeIcon(r.type)}
          </span>
          <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{r.label}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 truncate max-w-[120px]">{r.spec_name}</span>
        </div>
      ))}
    </div>
  );
}

function Section({
  title, count, reqs, accent,
}: {
  title: string;
  count: number;
  reqs: CompareReq[];
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border-2 ${accent} bg-white dark:bg-gray-900 overflow-hidden`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</span>
        </div>
        <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{count}</span>
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-800">
          <ReqList reqs={reqs} />
        </div>
      )}
    </div>
  );
}

// Simple Venn-like SVG diagram
function VennDiagram({ stats }: { stats: CompareResult['stats'] }) {
  const total = stats.total_a + stats.total_b - stats.common;
  if (total === 0) return null;

  return (
    <svg viewBox="0 0 200 100" className="w-full max-w-[200px] mx-auto">
      {/* Circle A */}
      <circle cx="75" cy="50" r="42" fill="#3B82F6" fillOpacity="0.2" stroke="#3B82F6" strokeWidth="1.5" />
      {/* Circle B */}
      <circle cx="125" cy="50" r="42" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="1.5" />
      {/* Labels */}
      <text x="52" y="53" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#3B82F6">{stats.only_a}</text>
      <text x="100" y="53" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#6B7280">{stats.common}</text>
      <text x="148" y="53" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#10B981">{stats.only_b}</text>
    </svg>
  );
}

export default function CompareTab({ projectId, sources }: Props) {
  const [sourceAId, setSourceAId] = useState<number | ''>('');
  const [sourceBId, setSourceBId] = useState<number | ''>('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCompare() {
    if (!sourceAId || !sourceBId || sourceAId === sourceBId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.compare(projectId, Number(sourceAId), Number(sourceBId));
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? 'Comparison failed');
    } finally {
      setLoading(false);
    }
  }

  const canCompare = sourceAId && sourceBId && sourceAId !== sourceBId;

  return (
    <div className="flex gap-6 items-start">

      {/* ── Left sidebar ── */}
      <div className="w-64 flex-shrink-0 space-y-4 sticky top-0">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Select IDS Sources
          </h3>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">IDS A</label>
              <select
                value={sourceAId}
                onChange={e => { setSourceAId(e.target.value === '' ? '' : Number(e.target.value)); setResult(null); }}
                className="w-full text-xs border border-blue-300 dark:border-blue-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— choose —</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id} disabled={s.id === sourceBId}>
                    {s.filename}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-center">
              <span className="text-sm font-bold text-gray-400">vs</span>
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">IDS B</label>
              <select
                value={sourceBId}
                onChange={e => { setSourceBId(e.target.value === '' ? '' : Number(e.target.value)); setResult(null); }}
                className="w-full text-xs border border-green-300 dark:border-green-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">— choose —</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id} disabled={s.id === sourceAId}>
                    {s.filename}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={runCompare}
            disabled={!canCompare || loading}
            className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Comparing…' : 'Compare'}
          </button>
        </div>

        {/* Dashboard summary — shown after comparison */}
        {result && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Summary
            </h3>

            <VennDiagram stats={result.stats} />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400 truncate max-w-[100px]">{result.source_a.filename}</span>
                </span>
                <span className="font-bold text-gray-700 dark:text-gray-300">{result.stats.total_a}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400 truncate max-w-[100px]">{result.source_b.filename}</span>
                </span>
                <span className="font-bold text-gray-700 dark:text-gray-300">{result.stats.total_b}</span>
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Common</span>
                <span className="font-bold text-gray-700 dark:text-gray-300">{result.stats.common}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-600 dark:text-blue-400">Only in A</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{result.stats.only_a}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600 dark:text-green-400">Only in B</span>
                <span className="font-bold text-green-600 dark:text-green-400">{result.stats.only_b}</span>
              </div>
            </div>

            {/* Stacked bar */}
            {result.stats.total_a + result.stats.total_b > 0 && (() => {
              return (
                <div className="flex h-3 rounded-full overflow-hidden gap-px">
                  {result.stats.only_a > 0 && (
                    <div className="bg-blue-400 dark:bg-blue-500" style={{ flex: result.stats.only_a }} title={`Only in A: ${result.stats.only_a}`} />
                  )}
                  {result.stats.common > 0 && (
                    <div className="bg-gray-400 dark:bg-gray-500" style={{ flex: result.stats.common }} title={`Common: ${result.stats.common}`} />
                  )}
                  {result.stats.only_b > 0 && (
                    <div className="bg-green-400 dark:bg-green-500" style={{ flex: result.stats.only_b }} title={`Only in B: ${result.stats.only_b}`} />
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        {!result && !loading && (
          <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Select two IDS sources and click Compare.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {/* Source labels */}
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-blue-700 dark:text-blue-300">A: {result.source_a.title || result.source_a.filename}</span>
              </span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-full bg-green-400 flex-shrink-0" />
                <span className="text-green-700 dark:text-green-300">B: {result.source_b.title || result.source_b.filename}</span>
              </span>
            </div>

            <Section
              title="Common requirements"
              count={result.stats.common}
              reqs={result.common}
              accent="border-gray-200 dark:border-gray-700"
            />
            <Section
              title={`Only in A — ${result.source_a.title || result.source_a.filename}`}
              count={result.stats.only_a}
              reqs={result.only_a}
              accent="border-blue-200 dark:border-blue-800"
            />
            <Section
              title={`Only in B — ${result.source_b.title || result.source_b.filename}`}
              count={result.stats.only_b}
              reqs={result.only_b}
              accent="border-green-200 dark:border-green-800"
            />
          </div>
        )}
      </div>
    </div>
  );
}
