import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '@core/confirm/confirm.service';
import { UNSAVED_SELLER_CONFIRMATION } from '../constants/edit-seller-page.constants';
import type { EditSellerLeaveTarget } from '../models/edit-seller-page.models';

// Pregunta antes de cerrar «Editar datos» con cambios sin guardar. Mientras guarda no se cierra: la
// respuesta del guardado llegaría a un pop-up ya cerrado.
export const unsavedSellerGuard: CanDeactivateFn<EditSellerLeaveTarget> = (target) => {
  if (target.saving()) return false;
  if (!target.hasUnsavedChanges()) return true;
  return inject(ConfirmService).ask(UNSAVED_SELLER_CONFIRMATION);
};
