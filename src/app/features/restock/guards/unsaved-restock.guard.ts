import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '@core/confirm/confirm.service';
import { UNSAVED_LEAVE_CONFIRMATION } from '../constants/restock-page.constants';
import type { RestockLeaveTarget } from '../models/restock-page.models';

// Pregunta antes de salir de la lista de resurtir con cambios sin guardar. Mientras un envío está en
// curso no se sale: la respuesta del guardado llegaría a una pantalla ya cerrada.
export const unsavedRestockGuard: CanDeactivateFn<RestockLeaveTarget> = (target) => {
  if (target.saving()) return false;
  if (!target.hasUnsavedChanges()) return true;
  return inject(ConfirmService).ask(UNSAVED_LEAVE_CONFIRMATION);
};
