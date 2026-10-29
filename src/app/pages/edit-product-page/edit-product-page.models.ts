export type EditProductState = 'loading-product' | 'not-found' | 'load-error' | 'form' | 'saving' | 'offline';

// Parte del estado que decide el guardado; la carga sale del recurso del producto.
export type SaveState = Extract<EditProductState, 'form' | 'saving' | 'offline' | 'not-found'>;
