import type { ConfirmTone } from './confirm.models';

// Severidad del botón de aceptar según el tono; `undefined` es el botón primario de la marca.
export const CONFIRM_ACCEPT_SEVERITY: Record<ConfirmTone, 'danger' | undefined> = {
  danger: 'danger',
  default: undefined,
};

export const CONFIRM_REJECT_SEVERITY = 'secondary';

// Ancho del diálogo: 24rem como el diálogo propio de antes, y en celular (≤ 639 px) todo el
// ancho menos el margen de 1rem por lado.
export const CONFIRM_DIALOG_STYLE = { width: '24rem' };
export const CONFIRM_DIALOG_BREAKPOINTS = { '639px': 'calc(100vw - 2rem)' };
