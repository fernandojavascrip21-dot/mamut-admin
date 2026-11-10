import type { RestockLineForm } from '../components/restock-form/restock-form.models';

// Total estimado de la lista: dinero como texto de dos decimales y cuántos renglones escritos no
// traen costo.
export interface RestockEstimate {
  total: string;
  withoutCost: number;
}

export function estimateTotal(lines: RestockLineForm[]): RestockEstimate {
  void lines;
  return { total: '', withoutCost: -1 };
}
