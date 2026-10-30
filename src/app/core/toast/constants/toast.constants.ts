import type { ToastTone } from '../components/toast/toast.models';

// Cuánto dura cada aviso flotante antes de cerrarse solo; el error dura más para leerlo.
export const TOAST_DURATION_MS: Record<ToastTone, number> = { success: 4000, error: 6000 };
