import type { CutTypeOption } from '../models/admin-cash-cut-page.models';

// Textos de «Corte» del administrador (HU-19). Son los del canvas y se confirman en el paso de diseño.
export const ADMIN_CASH_CUT_PAGE_TEXTS = {
  title: 'Corte',
  warehouseOwner: 'mis ventas',
  idleAria: 'Generar corte',
  idleHint: 'Revisa a quién, el periodo y el tipo de corte. El corte se calcula cuando lo generes.',
  generate: 'Generar corte',
  regenerate: 'Generar de nuevo',
  cutTypeLabel: 'Tipo de corte',
  cutTypeHelp: 'Usa los precios y el costo con envío que le pusiste a cada vendedor.',
  loadingTitle: 'Calculando el corte…',
  loadingHint: 'Sumando las ventas del periodo.',
  emptyTitle: 'No hay ventas en este periodo',
  emptyHint: 'Cambia el periodo o el vendedor para ver otro corte.',
  errorTitle: 'No se pudo generar el corte',
  errorHint: 'Revisa tu conexión e inténtalo de nuevo.',
  retry: 'Reintentar',
  resultTitle: 'Corte con precios',
  generatedAt: 'Generado hoy a las',
  productsOfSeller: 'Lo que vendió',
  productsOfWarehouse: 'Lo que vendí',
  productsColumns: 'vendido · ganancia',
  salesTitle: 'Ventas',
} as const;

// «Corte con precios» es el único tipo que existe; «para casa» llega con M4b y por ahora no se puede elegir.
export const CUT_TYPE_OPTIONS: CutTypeOption[] = [
  { value: 'seller', label: 'Corte con precios (para vendedor)', disabled: false },
  { value: 'home', label: 'Corte (para casa) · Próximamente', disabled: true },
];

export const DEFAULT_CUT_TYPE = 'seller';
