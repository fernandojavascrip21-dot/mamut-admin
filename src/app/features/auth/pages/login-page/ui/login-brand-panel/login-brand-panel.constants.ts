import type { HeadlineWord } from './login-brand-panel.models';

export const BRAND_NAME = 'Mammut Supplements';
export const LOGO_ALT = 'Mammut Supplements';
export const BRAND_TAGLINE = 'Bodega, vendedores y ventas en un solo lugar.';

// «Tu stock, / al día.»: entran palabra por palabra después del logo.
export const HEADLINE_WORDS: readonly HeadlineWord[] = [
  { text: 'Tu', highlighted: false, breakAfter: false, delaySeconds: 0.25 },
  { text: 'stock,', highlighted: false, breakAfter: true, delaySeconds: 0.33 },
  { text: 'al', highlighted: true, breakAfter: false, delaySeconds: 0.41 },
  { text: 'día.', highlighted: true, breakAfter: false, delaySeconds: 0.49 },
];

// Retrasos (s) del revelado: logo primero, subtítulo al final del titular.
export const LOGO_DELAY_SECONDS = 0.05;
export const TAGLINE_DELAY_SECONDS = 0.6;
