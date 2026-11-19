export type SellerPasswordPageState = 'loading' | 'error' | 'not-found' | 'inactive' | 'ready';

// Estado del guardado: `idle` con el formulario, `offline` con el aviso de reintento y `not-found` si el vendedor se borró.
export type SellerPasswordSaveState = 'idle' | 'saving' | 'offline' | 'not-found';
