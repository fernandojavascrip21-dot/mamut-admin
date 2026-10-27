import type { CanDeactivateFn } from '@angular/router';

export interface ConCambiosSinGuardar {
  tieneCambiosSinGuardar(): boolean;
  confirmarDescartar(): Promise<boolean>;
}

// Deja salir directamente de formularios limpios; el componente decide cómo confirmar cambios.
export const cambiosSinGuardarGuard: CanDeactivateFn<ConCambiosSinGuardar> = (component) =>
  component.tieneCambiosSinGuardar() ? component.confirmarDescartar() : true;
