import type { CutPeriodKind } from '../interfaces/cash-cut.models';

// Periodo elegido: la clase y cuántos periodos atrás (0 = el actual, -1 = el anterior).
export interface CutSelection {
  kind: CutPeriodKind;
  offset: number;
}

// Qué muestra la página: la tarjeta «Generar corte» (idle), «Calculando…», el error, el estado vacío
// (sin ventas) o el corte.
export type CashCutPageState = 'idle' | 'loading' | 'error' | 'empty' | 'ready';

export interface CutTypeOption {
  value: 'seller' | 'home';
  label: string;
  disabled: boolean;
}
