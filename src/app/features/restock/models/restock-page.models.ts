import type { RestockOrder, RestockProduct, RestockSuggestion } from '../interfaces/restock.models';

// Lo que necesita la pantalla al entrar: borrador (o null), sugerencias y productos pedibles.
export interface RestockPageData {
  draft: RestockOrder | null;
  suggestions: RestockSuggestion[];
  products: RestockProduct[];
}

// Lo que el guard de salida necesita saber de la página.
export interface RestockLeaveTarget {
  hasUnsavedChanges(): boolean;
  saving(): boolean;
}
