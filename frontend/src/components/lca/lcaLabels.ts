/** User-facing English labels for LCA / carbon dashboard (UI only; data stays canonical). */

export function confidenceLabel(code: string): string {
  switch (code) {
    case 'order_of_magnitude':
      return 'Order of magnitude';
    case 'indicative':
      return 'Indicative';
    case 'detailed':
      return 'Detailed';
    case 'certified':
      return 'Certified';
    default:
      return code.replace(/_/g, ' ');
  }
}

/** EN 15978 stage_check JSON keys → short English descriptions */
export const STAGE_CHECK_LABELS: Record<string, string> = {
  A1: 'A1 — Raw material supply',
  A2: 'A2 — Transport to manufacturer (projected)',
  A3: 'A3 — Manufacturing (via GWP factor)',
  A4: 'A4 — Transport to site (projected)',
  A5: 'A5 — Construction / installation (projected)',
  'B1-B7': 'B1–B7 — Use stage (requires LOIN ≥ 4)',
  'C1-C4': 'C1–C4 — End of life (requires LOIN ≥ 4)',
  D: 'D — Benefits beyond system boundary (requires LOIN ≥ 4)',
};
