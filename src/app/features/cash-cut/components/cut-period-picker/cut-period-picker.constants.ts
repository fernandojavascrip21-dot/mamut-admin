import type { CutPeriodKind } from '../../interfaces/cash-cut.models';

// Textos y opciones del selector de periodo del corte.
export const CUT_PERIOD_PICKER_TEXTS = {
  previous: 'Anterior',
  next: 'Siguiente',
  previousLabel: 'Periodo anterior',
  nextLabel: 'Periodo siguiente',
  kindsLabel: 'Tipo de periodo',
} as const;

export const CUT_PERIOD_KIND_OPTIONS: { kind: CutPeriodKind; label: string }[] = [
  { kind: 'day', label: 'Día' },
  { kind: 'week', label: 'Semana' },
  { kind: 'month', label: 'Mes' },
];
