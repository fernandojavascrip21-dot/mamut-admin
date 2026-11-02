import type { ToastTone } from '../toast.models';

// Cuánto dura cada aviso flotante antes de cerrarse solo; el error dura más para leerlo.
export const TOAST_DURATION_MS: Record<ToastTone, number> = { success: 4000, error: 6000 };

// En celular (≤ 639 px) el aviso ocupa el ancho de la pantalla con el margen de 1rem de la app;
// en escritorio conserva el ancho del preset, arriba a la derecha.
export const TOAST_BREAKPOINTS = {
  '639px': { width: 'auto', left: '1rem', right: '1rem' },
};
