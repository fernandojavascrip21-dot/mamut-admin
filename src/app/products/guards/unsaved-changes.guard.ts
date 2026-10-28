import type { CanDeactivateFn } from '@angular/router';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
  confirmDiscard(): Promise<boolean>;
}

// Deja salir directamente de formularios limpios; el componente decide cómo confirmar cambios.
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  component.hasUnsavedChanges() ? component.confirmDiscard() : true;
