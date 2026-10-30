import type { StockBar } from './login-background.models';

// Columnas del fondo animado del login, de izquierda a derecha. Alturas, proporciones y tiempos
// distintos para que se lean como niveles de inventario que cambian, no como un ecualizador.
export const STOCK_BARS: readonly StockBar[] = [
  { heightPercent: 62, segments: [5, 3, 2, 1], durationSeconds: 7.5, delaySeconds: -1.2, showOnMobile: true },
  { heightPercent: 84, segments: [4, 2, 3, 1], durationSeconds: 9.8, delaySeconds: -4.1, showOnMobile: false },
  { heightPercent: 48, segments: [6, 2, 1, 1], durationSeconds: 6.4, delaySeconds: -2.6, showOnMobile: true },
  { heightPercent: 92, segments: [3, 3, 2, 2], durationSeconds: 10.6, delaySeconds: -6.3, showOnMobile: false },
  { heightPercent: 70, segments: [5, 2, 2, 1], durationSeconds: 8.2, delaySeconds: -0.4, showOnMobile: true },
  { heightPercent: 56, segments: [4, 3, 1, 2], durationSeconds: 7.1, delaySeconds: -3.7, showOnMobile: false },
  { heightPercent: 100, segments: [5, 3, 2, 1], durationSeconds: 11, delaySeconds: -5.2, showOnMobile: true },
  { heightPercent: 66, segments: [3, 2, 3, 1], durationSeconds: 8.9, delaySeconds: -2.1, showOnMobile: false },
  { heightPercent: 42, segments: [6, 1, 2, 1], durationSeconds: 6, delaySeconds: -1.8, showOnMobile: true },
  { heightPercent: 78, segments: [4, 3, 2, 1], durationSeconds: 9.3, delaySeconds: -7, showOnMobile: false },
  { heightPercent: 88, segments: [5, 2, 2, 2], durationSeconds: 10.1, delaySeconds: -3.3, showOnMobile: true },
  { heightPercent: 52, segments: [4, 2, 1, 1], durationSeconds: 6.8, delaySeconds: -4.8, showOnMobile: false },
  { heightPercent: 74, segments: [3, 3, 2, 1], durationSeconds: 8.6, delaySeconds: -0.9, showOnMobile: true },
  { heightPercent: 60, segments: [5, 2, 3, 1], durationSeconds: 7.7, delaySeconds: -5.9, showOnMobile: false },
];
