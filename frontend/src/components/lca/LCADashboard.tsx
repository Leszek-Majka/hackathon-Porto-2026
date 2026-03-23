import React, { useEffect } from 'react';
import { useLCADashboard } from '../../hooks/useLCADashboard';
import type { Phase } from '../../types/project';
import LCAPhaseSelector from './LCAPhaseSelector';
import DisciplineFilter from './DisciplineFilter';
import LCAKPICards from './LCAKPICards';
import LCADonutChart from './LCADonutChart';
import LCADisciplineStackedBar from './LCADisciplineStackedBar';
import LCADisciplineBreakdownTable from './LCADisciplineBreakdownTable';
import LCAPhaseLineChart from './LCAPhaseLineChart';
import LCAElementsTable from './LCAElementsTable';

interface Props {
  projectId: number;
  phases: Phase[];
  onPhasesChanged: () => void;
}

export default function LCADashboard({ projectId, phases: externalPhases, onPhasesChanged }: Props) {
  const {
    phases,
    disciplines,
    selectedPhase,
    setSelectedPhase,
    activeDisciplines,
    toggleDiscipline,
    resetDisciplines,
    checkResult,
    filteredElements,
    filteredKPIs,
    loading,
    checking,
    seeding,
    error,
    hasEntries,
    runCheck,
    seedRibaPhases,
    seedDisciplines,
    seedSample,
    fetchPhases,
  } = useLCADashboard(projectId);

  // Sync with external phases
  useEffect(() => {
    if (externalPhases.length > 0 && phases.length === 0) {
      fetchPhases();
    }
  }, [externalPhases, phases.length, fetchPhases]);

  // Auto-select R2 (Concept Design) if available
  useEffect(() => {
    if (phases.length > 0 && !selectedPhase) {
      const r2 = phases.find(p => p.code === 'R2');
      if (r2) setSelectedPhase(r2.id);
      else setSelectedPhase(phases[0].id);
    }
  }, [phases, selectedPhase, setSelectedPhase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  const effectivePhases = phases.length > 0 ? phases : externalPhases;

  return (
    <div className="space-y-6">
      {/* Seed buttons - progressive onboarding */}
      {effectivePhases.length === 0 && (
        <SeedCard
          message="No phases defined yet."
          buttonLabel="Seed RIBA Phases"
          color="teal"
          loading={seeding}
          onClick={async () => { await seedRibaPhases(); onPhasesChanged(); }}
        />
      )}

      {effectivePhases.length > 0 && disciplines.length === 0 && (
        <SeedCard
          message="No disciplines defined yet."
          buttonLabel="Seed Disciplines"
          color="blue"
          loading={seeding}
          onClick={seedDisciplines}
        />
      )}

      {disciplines.length > 0 && !hasEntries && !checkResult && (
        <SeedCard
          message="No LCA data yet."
          buttonLabel="Load Sample Data"
          color="amber"
          loading={seeding}
          onClick={seedSample}
        />
      )}

      {/* Phase selector */}
      {effectivePhases.length > 0 && (
        <LCAPhaseSelector
          phases={effectivePhases}
          selectedPhaseId={selectedPhase}
          onSelect={(id) => setSelectedPhase(id === selectedPhase ? null : id)}
        />
      )}

      {/* Discipline filter */}
      {disciplines.length > 0 && (
        <DisciplineFilter
          disciplines={disciplines}
          active={activeDisciplines}
          onToggle={toggleDiscipline}
          onReset={resetDisciplines}
        />
      )}

      {/* KPI Cards */}
      {filteredKPIs && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key indicators</h3>
          <LCAKPICards
            totalMassKg={filteredKPIs.totalMassKg}
            gwpA1A3={filteredKPIs.gwpA1A3}
            gwpWLC={filteredKPIs.gwpWLC}
            passCount={filteredKPIs.passCount}
            warnCount={filteredKPIs.warnCount}
            failCount={filteredKPIs.failCount}
            totalElements={filteredKPIs.totalElements}
            confidence={filteredKPIs.confidence}
            loinLevel={filteredKPIs.loinLevel}
          />
        </div>
      )}

      {/* Discipline breakdown table */}
      {checkResult && Object.keys(filteredKPIs?.byDiscipline || {}).length > 0 && (
        <LCADisciplineBreakdownTable
          byDiscipline={filteredKPIs!.byDiscipline}
          totalMass={filteredKPIs!.totalMassKg}
          totalA1A3={filteredKPIs!.gwpA1A3}
        />
      )}

      {/* bsDD Connection Banner */}
      {checkResult && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data provenance</h3>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 flex items-center gap-2 text-xs overflow-x-auto">
            <span className="bg-teal-900/50 text-teal-400 px-2 py-1 rounded">IDS property URI</span>
            <span className="text-gray-500">→</span>
            <a
              href="https://search.bsdd.buildingsmart.org"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-900/50 text-blue-400 px-2 py-1 rounded hover:underline"
            >
              buildingSMART Data Dictionary
            </a>
            <span className="text-gray-500">→</span>
            <span className="bg-amber-900/50 text-amber-400 px-2 py-1 rounded">Data type, unit, GWP (A1–A3)</span>
            <span className="text-gray-500">→</span>
            <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded">Validated row</span>
          </div>
        </div>
      )}

      {/* Charts */}
      {filteredKPIs && (
        <>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Charts</h3>
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-6">
            <LCADonutChart
              byStage={filteredKPIs.byStage}
              loinLevel={filteredKPIs.loinLevel}
            />
            <LCADisciplineStackedBar
              byDiscipline={filteredKPIs.byDiscipline}
            />
          </div>
        </>
      )}

      {/* Actions bar */}
      {(hasEntries || checkResult) && selectedPhase && (
        <div className="flex gap-3 items-center">
          <button
            onClick={runCheck}
            disabled={checking}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {checking && (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            )}
            {checking ? 'Checking...' : 'Run LCA Check'}
          </button>
          {!checkResult && hasEntries && (
            <span className="text-xs text-gray-500">Select a phase and run a check to see results</span>
          )}
          {error && (
            <span className="text-xs text-red-400">{error}</span>
          )}
        </div>
      )}

      {/* Elements table */}
      {filteredElements.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            LCA elements — {filteredElements.length} items
          </h3>
          <LCAElementsTable
            elements={filteredElements}
            disciplines={disciplines}
          />
        </div>
      )}
    </div>
  );
}

// --- Helper component ---

function SeedCard({
  message,
  buttonLabel,
  color,
  loading,
  onClick,
}: {
  message: string;
  buttonLabel: string;
  color: 'teal' | 'blue' | 'amber';
  loading: boolean;
  onClick: () => void;
}) {
  const colors = {
    teal: 'bg-teal-600 hover:bg-teal-500',
    blue: 'bg-blue-600 hover:bg-blue-500',
    amber: 'bg-amber-600 hover:bg-amber-500',
  };
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
      <p className="text-gray-400 text-sm mb-3">{message}</p>
      <button
        onClick={onClick}
        disabled={loading}
        className={`px-4 py-2 ${colors[color]} text-white text-sm rounded-lg disabled:opacity-50`}
      >
        {loading ? 'Loading...' : buttonLabel}
      </button>
    </div>
  );
}
