export type EditSellerState = 'loading' | 'not-found' | 'error' | 'form' | 'saving' | 'offline';

// Lo que el guard necesita del pop-up.
export interface EditSellerLeaveTarget {
  saving(): boolean;
  hasUnsavedChanges(): boolean;
}

// Estado del envío del pop-up: `offline` es «no se pudo guardar», con Reintentar.
export type EditSellerSaveState = 'idle' | 'saving' | 'offline';

// Acción de estado del pop-up (HU-44) y lo que lo tiene ocupado: una de ellas o el guardado del formulario.
export type EditSellerStatusAction = 'deactivate' | 'reactivate' | 'remove';
export type EditSellerBusy = EditSellerStatusAction | 'saving' | null;
