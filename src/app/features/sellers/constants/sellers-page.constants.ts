import type { SellersFilter } from '../models/sellers-page.models';

// Opciones del filtro de «Mis vendedores», en su orden.
export const SELLERS_FILTER_OPTIONS: { label: string; value: SellersFilter }[] = [
  { label: 'Activos', value: 'active' },
  { label: 'Desactivados', value: 'inactive' },
];

// Nombre accesible del filtro.
export const SELLERS_FILTER_LABEL = 'Qué vendedores mostrar';

// Vacío de la lista de desactivados.
export const SELLERS_INACTIVE_EMPTY_TITLE = 'No tienes vendedores desactivados';
export const SELLERS_INACTIVE_EMPTY_HINT = 'Aquí aparecen los vendedores que desactives.';
