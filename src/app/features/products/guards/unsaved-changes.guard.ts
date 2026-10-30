import type { CanDeactivateFn } from '@angular/router';
import type { HasUnsavedChanges } from '../interfaces/unsaved-changes.models';

// Deja salir directamente de formularios limpios; el componente decide cómo confirmar cambios.
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  component.hasUnsavedChanges() ? component.confirmDiscard() : true;
