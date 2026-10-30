// Un vendedor activo como opción de la barra «Viendo» (de GET /api/sellers solo se usan estos dos campos).
export interface ViewingSeller {
  id: string;
  fullName: string;
}

// Estado de la lista de vendedores de la barra.
export type ViewingListStatus = 'loading' | 'error' | 'ready';
