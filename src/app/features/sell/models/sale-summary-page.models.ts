import type { SALE_SUMMARY_LINKS, SALE_SUMMARY_TEXTS } from '../constants/sale-summary-page.constants';

// Estado de «Venta confirmada»: cargando, la venta leída, una venta que no existe (404, o 422 por una
// llave que no es UUID) o un error de red con «Reintentar».
export type SaleSummaryState = 'loading' | 'ready' | 'not-found' | 'error';

// Textos y enlaces que recibe `sale-summary-view`: la misma forma para los dos roles; cada página pasa
// los suyos (el administrador cambia «Ver stock», «Ir a productos» y los de cargando y error).
export type SaleSummaryTexts = { [K in keyof typeof SALE_SUMMARY_TEXTS]: string };
export type SaleSummaryLinks = { [K in keyof typeof SALE_SUMMARY_LINKS]: string };
