import type { RestockLineForm } from '../components/restock-form/restock-form.models';
import type { RestockOrder, RestockProduct, RestockSuggestion } from '../interfaces/restock.models';

// Lo que necesita la pantalla al entrar: borrador (o null), sugerencias y productos pedibles.
export interface RestockPageData {
  draft: RestockOrder | null;
  suggestions: RestockSuggestion[];
  products: RestockProduct[];
}

// Renglones de un pedido base ya listos para el formulario, con lo que se omitió de él (HU-32).
export interface RestockBaseReady {
  lines: RestockLineForm[];
  skipped: number;
  baseClosedAt: string;
}

// Pedido base aplicado a la lista: sus renglones y la nota que la lista conserva (la del borrador, o vacía).
export interface RestockBaseReplacement extends RestockBaseReady {
  note: string;
}

// Qué hace la pantalla con el pedido base: no sirve (no existe o es un borrador) o trae renglones.
export type RestockBaseOutcome = { kind: 'missing' } | ({ kind: 'ready' } & RestockBaseReady);

// Una carga de la pantalla: la página y, si la URL pidió un base, su resultado (null si no lo pidió).
export interface RestockScreenLoad {
  page: RestockPageData;
  base: RestockBaseOutcome | null;
}

// Total estimado de la lista: texto de dos decimales y cuántos renglones escritos no traen costo.
export interface RestockEstimate {
  total: string;
  withoutCost: number;
}

// Lo que el guard de salida necesita saber de la página.
export interface RestockLeaveTarget {
  hasUnsavedChanges(): boolean;
  saving(): boolean;
}

// Pedido que la pantalla ya guardó sobre la carga `base`: sustituye al borrador de esa carga hasta que
// llega una nueva. `draft: null` significa que el borrador ya se descartó.
export interface RestockSavedDraft {
  base: RestockPageData;
  draft: RestockOrder | null;
}
