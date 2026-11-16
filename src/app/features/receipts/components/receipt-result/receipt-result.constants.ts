import { pluralize } from '@shared/utils/pluralize';

// Textos del resultado de una remisión (HU-42 §3). Las funciones concuerdan con la cantidad.
export const RECEIPT_RESULT_TEXTS = {
  registered: (count: number) => `${count} ${pluralize(count, 'entrada', 'entradas')} registradas`,
  // «K productos nuevos y C cambios» es sujeto compuesto con «y»: el verbo va en plural aunque K o C sea 1 o 0.
  pendingSummary: (newCount: number, costCount: number) =>
    `${newCount} ${pluralize(newCount, 'producto nuevo', 'productos nuevos')} y ${costCount} `
    + `${pluralize(costCount, 'cambio de costo', 'cambios de costo')} quedaron pendientes`,
} as const;
