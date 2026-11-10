import type { RestockOrder, RestockProduct, RestockSuggestion } from '../interfaces/restock.models';

// Lo que necesita la pantalla al entrar: borrador (o null), sugerencias y productos pedibles.
export interface RestockPageData {
  draft: RestockOrder | null;
  suggestions: RestockSuggestion[];
  products: RestockProduct[];
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
