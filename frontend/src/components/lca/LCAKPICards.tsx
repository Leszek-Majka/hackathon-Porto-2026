import React from 'react';

interface Props {
  totalMassKg: number;
  gwpA1A3: number;
  gwpWLC: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  totalElements: number;
  confidence: string;
  loinLevel: number;
}

function formatTonnes(kg: number): string {
  const t = kg / 1000;
  if (t >= 1000) return `${(t / 1000).toFixed(1)}k`;
  if (t >= 1) return t.toFixed(1);
  return (kg).toFixed(0);
}

function formatKg(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function confidenceBadge(loin: number): string {
  if (loin <= 1) return '±50%';
  if (loin === 2) return '±30% SD';
  if (loin === 3) return '±15% DD';
  return '±5% TD';
}

export default function LCAKPICards({
  totalMassKg,
  gwpA1A3,
  gwpWLC,
  passCount,
  warnCount,
  failCount,
  totalElements,
  confidence,
  loinLevel,
}: Props) {
  const allPass = failCount === 0 && warnCount === 0;
  const hasFailures = failCount > 0;
  const checkColor = hasFailures ? '#e05252' : warnCount > 0 ? '#f4a031' : '#2E7D32';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* ILS 17 — Mass */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full opacity-10"
          style={{ backgroundColor: '#3b9eff' }} />
        <p className="text-xs text-gray-500 mb-1">ILS 17 — Total material mass</p>
        <p className="text-2xl font-mono font-bold" style={{ color: '#3b9eff' }}>
          {formatTonnes(totalMassKg)}
        </p>
        <p className="text-xs text-gray-500">{totalMassKg >= 1000 ? 't' : 'kg'}</p>
        <span className="absolute top-3 right-3 text-[10px] font-mono text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
          {confidenceBadge(loinLevel)}
        </span>
      </div>

      {/* ILS 18 — GWP A1-A3 */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full opacity-10"
          style={{ backgroundColor: '#00c8a0' }} />
        <p className="text-xs text-gray-500 mb-1">ILS 18 — GWP (A1–A3)</p>
        <p className="text-2xl font-mono font-bold" style={{ color: '#00c8a0' }}>
          {formatKg(gwpA1A3)}
        </p>
        <p className="text-xs text-gray-500">kgCO₂e — Product stage (EN 15804)</p>
        <span className="absolute top-3 right-3 text-[10px] font-mono text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
          {confidenceBadge(loinLevel)}
        </span>
      </div>

      {/* ILS 19 — WLC */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full opacity-10"
          style={{ backgroundColor: '#f4a031' }} />
        <p className="text-xs text-gray-500 mb-1">ILS 19 — Whole-life carbon</p>
        <p className="text-2xl font-mono font-bold" style={{ color: '#f4a031' }}>
          {formatKg(gwpWLC)}
        </p>
        <p className="text-xs text-gray-500">kgCO₂e — ×2.2 projection (RICS)</p>
        <span className="absolute top-3 right-3 text-[10px] font-mono text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
          {confidenceBadge(loinLevel)}
        </span>
      </div>

      {/* Check Status */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full opacity-10"
          style={{ backgroundColor: checkColor }} />
        <p className="text-xs text-gray-500 mb-1">LCA Data Check</p>
        <p className="text-2xl font-mono font-bold" style={{ color: checkColor }}>
          {passCount}/{totalElements}
        </p>
        <div className="flex items-center gap-2 text-xs mt-1">
          {passCount > 0 && (
            <span className="text-green-400">{passCount} pass</span>
          )}
          {warnCount > 0 && (
            <span className="text-amber-400">{warnCount} warn</span>
          )}
          {failCount > 0 && (
            <span className="text-red-400 animate-pulse">{failCount} fail</span>
          )}
          {allPass && totalElements > 0 && (
            <span className="text-green-400">All passed</span>
          )}
        </div>
      </div>
    </div>
  );
}
