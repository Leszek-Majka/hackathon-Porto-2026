import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import type { Phase } from '../types/project';
import type { Discipline } from '../types/setup';
import type { LCACheckResult, ElementCheck, DisciplineBreakdown } from '../types/lca';

export interface FilteredKPIs {
  totalMassKg: number;
  gwpA1A3: number;
  gwpWLC: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  totalElements: number;
  confidence: string;
  loinLevel: number;
  byStage: Record<string, number | null>;
  byDiscipline: Record<string, DisciplineBreakdown>;
}

export function useLCADashboard(projectId: number) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [activeDisciplines, setActiveDisciplines] = useState<string[]>([]);
  const [checkResult, setCheckResult] = useState<LCACheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEntries, setHasEntries] = useState(false);

  const fetchPhases = useCallback(async () => {
    try {
      const p = await api.phases.list(projectId);
      setPhases(p);
    } catch { /* empty */ }
  }, [projectId]);

  const fetchDisciplines = useCallback(async () => {
    try {
      const d = await api.disciplines.list(projectId);
      setDisciplines(d);
      setActiveDisciplines(d.map(x => x.code ?? x.abbreviation ?? ''));
    } catch { /* empty */ }
  }, [projectId]);

  const checkForEntries = useCallback(async () => {
    try {
      const entries = await api.lca.list(projectId);
      setHasEntries(entries.length > 0);
    } catch { /* empty */ }
  }, [projectId]);

  // Fetch the latest check result for the selected phase
  const fetchLatestCheck = useCallback(async () => {
    if (!selectedPhase) {
      setCheckResult(null);
      return;
    }
    try {
      const runs = await api.lcaCheck.list(projectId);
      const phaseRuns = runs.filter(r => r.phase_id === selectedPhase);
      if (phaseRuns.length > 0) {
        const latest = phaseRuns[0]; // already sorted desc by run_at
        const full = await api.lcaCheck.get(projectId, latest.id);
        setCheckResult(full);
      } else {
        setCheckResult(null);
      }
    } catch {
      setCheckResult(null);
    }
  }, [projectId, selectedPhase]);

  // Run a new LCA check
  const runCheck = useCallback(async () => {
    if (!selectedPhase) return;
    setChecking(true);
    setError(null);
    try {
      const res = await api.lcaCheck.run(projectId, selectedPhase);
      setCheckResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setChecking(false);
    }
  }, [projectId, selectedPhase]);

  // Seed functions
  const seedRibaPhases = useCallback(async () => {
    setSeeding(true);
    try {
      await api.lca.seedRibaPhases(projectId);
      await fetchPhases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed phases');
    } finally {
      setSeeding(false);
    }
  }, [projectId, fetchPhases]);

  const seedDisciplines = useCallback(async () => {
    setSeeding(true);
    try {
      await api.disciplines.seed(projectId);
      await fetchDisciplines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed disciplines');
    } finally {
      setSeeding(false);
    }
  }, [projectId, fetchDisciplines]);

  const seedSample = useCallback(async () => {
    setSeeding(true);
    try {
      await api.lca.seedSample(projectId);
      setHasEntries(true);
      if (selectedPhase) {
        await runCheck();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed sample');
    } finally {
      setSeeding(false);
    }
  }, [projectId, selectedPhase, runCheck]);

  const toggleDiscipline = useCallback((code: string) => {
    setActiveDisciplines(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  }, []);

  const resetDisciplines = useCallback(() => {
    setActiveDisciplines(disciplines.map(x => x.code ?? x.abbreviation ?? ''));
  }, [disciplines]);

  // Filter elements by active disciplines
  const filteredElements = useMemo((): ElementCheck[] => {
    if (!checkResult) return [];
    if (activeDisciplines.length === 0) return checkResult.elements;
    return checkResult.elements.filter(e => activeDisciplines.includes(e.discipline));
  }, [checkResult, activeDisciplines]);

  // Compute filtered KPIs
  const filteredKPIs = useMemo((): FilteredKPIs | null => {
    if (!checkResult) return null;
    const elems = filteredElements;
    const totalMassKg = elems.reduce((s, e) => s + (e.mass_kg || 0), 0);
    const gwpA1A3 = elems.reduce((s, e) => s + (e.gwp_a1a3 || 0), 0);
    const gwpWLC = gwpA1A3 * 2.2;
    const passCount = elems.filter(e => e.status === 'pass').length;
    const warnCount = elems.filter(e => e.status === 'warn').length;
    const failCount = elems.filter(e => e.status === 'fail').length;

    // Rebuild by_stage from filtered elements
    const byStage: Record<string, number | null> = {};
    byStage['A1'] = Math.round(gwpA1A3 * 0.35 * 100) / 100;
    byStage['A2'] = Math.round(gwpA1A3 * 0.10 * 100) / 100;
    byStage['A3'] = Math.round(gwpA1A3 * 0.55 * 100) / 100;
    byStage['A4'] = Math.round(gwpA1A3 * 0.05 * 100) / 100;
    byStage['A5'] = Math.round(gwpA1A3 * 0.03 * 100) / 100;
    byStage['B1-B7'] = checkResult.by_stage['B1-B7'] ?? null;
    byStage['C1-C4'] = checkResult.by_stage['C1-C4'] ?? null;
    byStage['D'] = checkResult.by_stage['D'] ?? null;

    // Rebuild by_discipline from filtered elements
    const byDiscipline: Record<string, DisciplineBreakdown> = {};
    for (const elem of elems) {
      const code = elem.discipline || 'UNKNOWN';
      if (!byDiscipline[code]) {
        const orig = checkResult.by_discipline[code];
        byDiscipline[code] = {
          gwp_a1a3: 0, gwp_a4a5: 0, mass_kg: 0,
          pass_count: 0, warn_count: 0, fail_count: 0,
          color: orig?.color || '#888',
        };
      }
      const bd = byDiscipline[code];
      bd.gwp_a1a3 += elem.gwp_a1a3 || 0;
      bd.gwp_a4a5 += elem.gwp_a4a5 || 0;
      bd.mass_kg += elem.mass_kg || 0;
      if (elem.status === 'pass') bd.pass_count++;
      else if (elem.status === 'warn') bd.warn_count++;
      else if (elem.status === 'fail') bd.fail_count++;
    }

    return {
      totalMassKg,
      gwpA1A3: Math.round(gwpA1A3 * 100) / 100,
      gwpWLC: Math.round(gwpWLC * 100) / 100,
      passCount,
      warnCount,
      failCount,
      totalElements: elems.length,
      confidence: checkResult.elements[0]?.confidence || 'order_of_magnitude',
      loinLevel: checkResult.loin_level,
      byStage,
      byDiscipline,
    };
  }, [checkResult, filteredElements]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPhases(), fetchDisciplines(), checkForEntries()])
      .finally(() => setLoading(false));
  }, [fetchPhases, fetchDisciplines, checkForEntries]);

  // Fetch latest check when phase changes
  useEffect(() => {
    if (selectedPhase) {
      fetchLatestCheck();
    }
  }, [selectedPhase, fetchLatestCheck]);

  return {
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
    fetchLatestCheck,
    fetchPhases,
  };
}
