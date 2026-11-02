import type { MotionOptions } from '@primeuix/motion';

// `safe` respeta prefers-reduced-motion, igual que el selector de categoría del formulario de producto.
export const PRODUCT_SELECT_MOTION_OPTIONS = { safe: true } satisfies MotionOptions;

// La lista no puede ser más ancha que la pantalla menos el margen de 1rem por lado (375 px sin scroll).
export const PRODUCT_SELECT_PANEL_STYLE = { maxWidth: 'calc(100vw - 2rem)' };
