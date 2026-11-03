import type { MotionOptions } from '@primeuix/motion';

// Textos visibles de la barra «Viendo» (HU-10).
export const VIEWING_LABEL = 'Viendo';
export const WAREHOUSE_OPTION_LABEL = 'Yo · bodega';
export const RETRY_LABEL = 'Reintentar';
export const LOAD_ERROR_HINT = 'No pudimos cargar a tus vendedores.';

// Valor de la opción «Yo · bodega»: el selector solo maneja texto, y '' se traduce a null.
export const WAREHOUSE_OPTION_VALUE = '';

// `safe` respeta prefers-reduced-motion, igual que los demás p-select de la app.
export const VIEWING_SELECT_MOTION_OPTIONS = { safe: true } satisfies MotionOptions;

// La lista no puede ser más ancha que la pantalla menos el margen de 1rem por lado (375 px sin scroll).
export const VIEWING_SELECT_PANEL_STYLE = { maxWidth: 'calc(100vw - 2rem)' };
