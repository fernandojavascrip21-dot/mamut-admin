import type { MotionOptions } from '@primeuix/motion';

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// `safe` respeta prefers-reduced-motion, igual que los demás controles de PrimeNG.
export const MODAL_PANEL_MOTION_OPTIONS = { safe: true } satisfies MotionOptions;

// La clase da el tamaño (pantalla completa en celular y centrado desde `sm`) en `styles.css`.
export const MODAL_PANEL_STYLE_CLASS = 'modal-panel-dialog';
