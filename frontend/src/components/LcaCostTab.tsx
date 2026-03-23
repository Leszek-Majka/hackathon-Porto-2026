import React, { useState, useMemo } from 'react';
import { useLcaCost } from '../hooks/useLcaCost';
import type { LcaCostParams, LcaCostProjection, LcaCostAssembly } from '../types/lcaCost';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface Props {
  projectId: number;
}

type SubTab = 'lca' | 'cost' | 'carbon-cost' | 'scenarios';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'lca', label: 'LCA Overview' },
  { id: 'cost', label: 'Life Cycle Cost' },
  { id: 'carbon-cost', label: 'Carbon Cost' },
  { id: 'scenarios', label: 'Scenarios' },
];

const COLORS = {
  capital: '#3b9eff',
  maintenance: '#00c8a0',
  replacement: '#f4a031',
  energy: '#e05252',
  carbon: '#b07ee8',
  total: '#ffffff',
  grid: '#1e3a5f',
  cardBg: '#111f35',
  panelBg: '#0d1929',
};

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
};

const fmtCurrency = (n: number) => `$${fmt(n)}`;

export default function LcaCostTab({ projectId }: Props) {
  const { data, loading, computing, error, compute, updateParams } = useLcaCost(projectId);
  const [subTab, setSubTab] = useState<SubTab>('lca');
  const [localParams, setLocalParams] = useState<LcaCostParams>({
    study_period: 40, discount_rate: 0.03, energy_escalation: 0.02, carbon_price: 300, grid_factor: 0.074,
  });

  // Sync localParams when data loads
  React.useEffect(() => {
    if (data?.params) setLocalParams(data.params);
  }, [data?.params]);

  const assemblies = data?.assemblies ?? [];
  const projections = data?.projections ?? [];
  const hasData = projections.length > 0;

  // Derived metrics
  const metrics = useMemo(() => {
    if (!hasData) return null;
    const yr0 = projections[0];
    const yrN = projections[projections.length - 1];
    const totalEmbodied = assemblies.reduce((s, a) => s + a.volume_m3 * a.gwp_kgco2e_m3, 0);
    return {
      totalCapital: yr0?.capital ?? 0,
      totalLCC: yrN?.cum_cost ?? 0,
      totalCarbon: yrN?.cum_carbon ?? 0,
      totalCarbonCost: yrN?.cum_carbon_cost ?? 0,
      embodiedCarbon: totalEmbodied / 1000,
      studyPeriod: localParams.study_period,
    };
  }, [hasData, projections, assemblies, localParams.study_period]);

  // Cost breakdown for pie chart
  const costBreakdown = useMemo(() => {
    if (!hasData) return [];
    const totals = { capital: 0, maintenance: 0, replacement: 0, energy: 0 };
    for (const p of projections) {
      totals.capital += p.capital;
      totals.maintenance += p.maintenance;
      totals.replacement += p.replacement;
      totals.energy += p.energy;
    }
    return [
      { name: 'Capital', value: totals.capital, color: COLORS.capital },
      { name: 'Maintenance', value: totals.maintenance, color: COLORS.maintenance },
      { name: 'Replacement', value: totals.replacement, color: COLORS.replacement },
      { name: 'Energy', value: totals.energy, color: COLORS.energy },
    ];
  }, [hasData, projections]);

  // Assembly summary by type
  const byType = useMemo(() => {
    const map: Record<string, { type: string; count: number; volume: number; gwp: number; cost: number }> = {};
    for (const a of assemblies) {
      if (!map[a.type]) map[a.type] = { type: a.type, count: 0, volume: 0, gwp: 0, cost: 0 };
      map[a.type].count++;
      map[a.type].volume += a.volume_m3;
      map[a.type].gwp += a.volume_m3 * a.gwp_kgco2e_m3;
      map[a.type].cost += a.cost_capital;
    }
    return Object.values(map).sort((a, b) => b.gwp - a.gwp);
  }, [assemblies]);

  // Sampled projections for charts (every 5 years)
  const chartData = useMemo(() => {
    return projections.filter(p => p.year % 5 === 0 || p.year === projections.length - 1);
  }, [projections]);

  const handleParamChange = (key: keyof LcaCostParams, value: number) => {
    setLocalParams(prev => ({ ...prev, [key]: value }));
  };

  const applyParams = () => {
    updateParams(localParams);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">LCA Cost Analysis</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            40-year life cycle cost and carbon projections
          </p>
        </div>
        <button
          onClick={compute}
          disabled={computing}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {computing ? 'Computing...' : hasData ? 'Recompute' : 'Compute Projections'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {!hasData && !computing && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No projection data yet</p>
          <p className="text-sm">Click "Compute Projections" to generate 40-year LCC and carbon analysis.</p>
          <p className="text-xs mt-2 text-gray-500">Uses your uploaded IFC model, or sample data if no IFC is available.</p>
        </div>
      )}

      {hasData && (
        <>
          {/* Sub-tab navigation */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {SUB_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  subTab === t.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* KPI Cards */}
          {metrics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Capital Cost" value={fmtCurrency(metrics.totalCapital)} accent={COLORS.capital} />
              <KpiCard label={`${metrics.studyPeriod}yr LCC (PV)`} value={fmtCurrency(metrics.totalLCC)} accent={COLORS.maintenance} />
              <KpiCard label="Whole Life Carbon" value={`${fmt(metrics.totalCarbon)} tCO₂e`} accent={COLORS.carbon} />
              <KpiCard label="Carbon Cost (PV)" value={fmtCurrency(metrics.totalCarbonCost)} accent={COLORS.energy} />
            </div>
          )}

          {/* Sub-tab content */}
          {subTab === 'lca' && <LcaOverview assemblies={assemblies} byType={byType} projections={projections} />}
          {subTab === 'cost' && <CostPanel projections={projections} chartData={chartData} costBreakdown={costBreakdown} />}
          {subTab === 'carbon-cost' && <CarbonCostPanel projections={projections} chartData={chartData} />}
          {subTab === 'scenarios' && (
            <ScenariosPanel
              params={localParams}
              onChange={handleParamChange}
              onApply={applyParams}
              computing={computing}
              projections={projections}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────────── */

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: accent, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
    </div>
  );
}

/* ── LCA Overview sub-tab ───────────────────────────────────────────── */

function LcaOverview({ assemblies, byType, projections }: {
  assemblies: LcaCostAssembly[];
  byType: { type: string; count: number; volume: number; gwp: number; cost: number }[];
  projections: LcaCostProjection[];
}) {
  const embodiedData = byType.map(t => ({
    name: t.type.replace('Ifc', ''),
    gwp: Math.round(t.gwp / 1000),
    cost: Math.round(t.cost),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Embodied carbon by element type */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Embodied Carbon by Element Type</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={embodiedData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number) => [`${v} tCO₂e`, 'GWP']}
            />
            <Bar dataKey="gwp" fill={COLORS.carbon} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Assembly table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Assemblies ({assemblies.length} elements)
        </h3>
        <div className="overflow-auto max-h-72">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 pr-2">Element</th>
                <th className="text-left py-2 pr-2">Type</th>
                <th className="text-right py-2 pr-2">Vol (m³)</th>
                <th className="text-right py-2 pr-2">GWP (tCO₂e)</th>
                <th className="text-right py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {assemblies.map((a, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-2 font-medium truncate max-w-[120px]">{a.name}</td>
                  <td className="py-1.5 pr-2 text-gray-500" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {a.type.replace('Ifc', '')}
                  </td>
                  <td className="py-1.5 pr-2 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {a.volume_m3.toFixed(1)}
                  </td>
                  <td className="py-1.5 pr-2 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {((a.volume_m3 * a.gwp_kgco2e_m3) / 1000).toFixed(1)}
                  </td>
                  <td className="py-1.5 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    ${fmt(a.cost_capital)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cumulative carbon over time */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Cumulative Carbon Over Time</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={projections}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${fmt(v)}t`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [`${v.toFixed(1)} tCO₂e`, 'Cumulative']}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Area type="monotone" dataKey="cum_carbon" stroke={COLORS.carbon} fill={COLORS.carbon} fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Cost Panel sub-tab ─────────────────────────────────────────────── */

function CostPanel({ projections, chartData, costBreakdown }: {
  projections: LcaCostProjection[];
  chartData: LcaCostProjection[];
  costBreakdown: { name: string; value: number; color: string }[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Stacked area: cost categories over time */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Annual Cost Breakdown (PV)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={projections}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtCurrency(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number, name: string) => [fmtCurrency(v), name]}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Area type="monotone" dataKey="capital" stackId="1" stroke={COLORS.capital} fill={COLORS.capital} fillOpacity={0.7} name="Capital" />
            <Area type="monotone" dataKey="maintenance" stackId="1" stroke={COLORS.maintenance} fill={COLORS.maintenance} fillOpacity={0.7} name="Maintenance" />
            <Area type="monotone" dataKey="replacement" stackId="1" stroke={COLORS.replacement} fill={COLORS.replacement} fillOpacity={0.7} name="Replacement" />
            <Area type="monotone" dataKey="energy" stackId="1" stroke={COLORS.energy} fill={COLORS.energy} fillOpacity={0.7} name="Energy" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cost breakdown donut */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Total Cost Split</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={costBreakdown}
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {costBreakdown.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [fmtCurrency(v)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 mt-2">
          {costBreakdown.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.color }} />
                <span className="text-gray-600 dark:text-gray-400">{c.name}</span>
              </div>
              <span className="text-gray-800 dark:text-gray-200 font-medium" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {fmtCurrency(c.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cumulative LCC */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Cumulative Life Cycle Cost (PV)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={projections}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtCurrency(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [fmtCurrency(v), 'Cumulative LCC']}
              labelFormatter={(l) => `Year ${l}`}
            />
            <ReferenceLine x={10} stroke="#f4a031" strokeDasharray="5 5" label={{ value: '10yr', fill: '#f4a031', fontSize: 10 }} />
            <ReferenceLine x={25} stroke="#f4a031" strokeDasharray="5 5" label={{ value: '25yr', fill: '#f4a031', fontSize: 10 }} />
            <Line type="monotone" dataKey="cum_cost" stroke={COLORS.capital} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Carbon Cost Panel ──────────────────────────────────────────────── */

function CarbonCostPanel({ projections, chartData }: {
  projections: LcaCostProjection[];
  chartData: LcaCostProjection[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Annual carbon emissions */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Annual Carbon Emissions</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={projections.filter(p => p.year % 2 === 0)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${v}t`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [`${v} tCO₂e`, 'Carbon']}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Bar dataKey="carbon_t" fill={COLORS.carbon} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Annual carbon cost */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Annual Carbon Cost (PV)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={projections}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtCurrency(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [fmtCurrency(v), 'Carbon Cost PV']}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Area type="monotone" dataKey="carbon_cost_pv" stroke={COLORS.energy} fill={COLORS.energy} fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative carbon cost vs LCC */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Cumulative: LCC vs Carbon Cost (PV)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={projections}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtCurrency(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number, name: string) => [fmtCurrency(v), name]}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Legend />
            <Line type="monotone" dataKey="cum_cost" stroke={COLORS.capital} strokeWidth={2} dot={false} name="LCC (PV)" />
            <Line type="monotone" dataKey="cum_carbon_cost" stroke={COLORS.energy} strokeWidth={2} dot={false} name="Carbon Cost (PV)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Scenarios Panel ────────────────────────────────────────────────── */

function ScenariosPanel({ params, onChange, onApply, computing, projections }: {
  params: LcaCostParams;
  onChange: (key: keyof LcaCostParams, value: number) => void;
  onApply: () => void;
  computing: boolean;
  projections: LcaCostProjection[];
}) {
  const yrN = projections[projections.length - 1];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Parameter sliders */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-5">Parameters</h3>
        <div className="space-y-5">
          <ParamSlider
            label="Study Period"
            value={params.study_period}
            min={10} max={60} step={5}
            unit="years"
            onChange={(v) => onChange('study_period', v)}
          />
          <ParamSlider
            label="Discount Rate"
            value={params.discount_rate}
            min={0} max={0.1} step={0.005}
            unit="%"
            displayMul={100}
            onChange={(v) => onChange('discount_rate', v)}
          />
          <ParamSlider
            label="Energy Escalation"
            value={params.energy_escalation}
            min={0} max={0.1} step={0.005}
            unit="%"
            displayMul={100}
            onChange={(v) => onChange('energy_escalation', v)}
          />
          <ParamSlider
            label="Carbon Price"
            value={params.carbon_price}
            min={50} max={1000} step={25}
            unit="$/tCO₂e"
            onChange={(v) => onChange('carbon_price', v)}
          />
          <ParamSlider
            label="Grid factor"
            value={params.grid_factor}
            min={0.01} max={0.3} step={0.002}
            unit="kgCO₂e/kWh"
            onChange={(v) => onChange('grid_factor', v)}
          />
        </div>
        <button
          onClick={onApply}
          disabled={computing}
          className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {computing ? 'Recomputing...' : 'Apply & Recompute'}
        </button>
      </div>

      {/* Impact summary */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Projection Summary</h3>
        {yrN && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <SummaryCard label="Total LCC (PV)" value={fmtCurrency(yrN.cum_cost)} color={COLORS.capital} />
            <SummaryCard label="Total Carbon" value={`${fmt(yrN.cum_carbon)} tCO₂e`} color={COLORS.carbon} />
            <SummaryCard label="Total Carbon Cost (PV)" value={fmtCurrency(yrN.cum_carbon_cost)} color={COLORS.energy} />
            <SummaryCard label="Combined Total" value={fmtCurrency(yrN.cum_cost + yrN.cum_carbon_cost)} color={COLORS.maintenance} />
          </div>
        )}
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={projections}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtCurrency(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number, name: string) => [fmtCurrency(v), name]}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Line type="monotone" dataKey="cum_cost" stroke={COLORS.capital} strokeWidth={2} dot={false} name="LCC" />
            <Line type="monotone" dataKey="cum_carbon_cost" stroke={COLORS.energy} strokeWidth={2} dot={false} name="Carbon Cost" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</div>
      <div className="text-lg font-bold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
    </div>
  );
}

function ParamSlider({ label, value, min, max, step, unit, displayMul, onChange }: {
  label: string;
  value: number;
  min: number; max: number; step: number;
  unit: string;
  displayMul?: number;
  onChange: (v: number) => void;
}) {
  const display = displayMul ? (value * displayMul).toFixed(1) : value;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-xs font-medium text-gray-800 dark:text-gray-200" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {display} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
      />
    </div>
  );
}
