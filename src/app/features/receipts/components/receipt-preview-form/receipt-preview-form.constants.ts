import { pluralize } from '@shared/utils/pluralize';

// Textos del formulario de revisión (HU-42 §3). La barra usa las mismas palabras que el resumen de la
// pantalla; los números salen de las reglas, no de aquí.
export const RECEIPT_PREVIEW_FORM_TEXTS = {
  confirm: 'Confirmar entrada',
  noLines: 'Quitaste todos los renglones',
  file: 'Archivo',
  // Barra inferior: cada cuenta concuerda con su sustantivo.
  summary: (lines: number, pieces: number, newProducts: number, costChanges: number) =>
    [
      `${lines} ${pluralize(lines, 'renglón', 'renglones')}`,
      `${pieces} ${pluralize(pieces, 'pieza', 'piezas')}`,
      `${newProducts} ${pluralize(newProducts, 'producto nuevo', 'productos nuevos')}`,
      `${costChanges} ${pluralize(costChanges, 'cambio de costo', 'cambios de costo')}`,
    ].join(' · '),
} as const;
