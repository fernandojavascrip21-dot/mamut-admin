// Estado de «Mis vendedores»: se deriva del status del recurso de la lista.
export type SellersState = 'loading' | 'error' | 'ready';

// Filtro de «Mis vendedores» (HU-44): activos o desactivados.
export type SellersFilter = 'active' | 'inactive';
