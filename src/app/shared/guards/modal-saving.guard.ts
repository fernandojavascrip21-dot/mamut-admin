import type { CanDeactivateFn } from '@angular/router';

// También «Atrás» debe esperar la respuesta: destruir el formulario cancelaría la suscripción
// antes de saber si se registró el movimiento. Sin aviso de cambios sin guardar.
export const modalSavingGuard: CanDeactivateFn<{ saving(): boolean }> = (component) =>
  !component.saving();
