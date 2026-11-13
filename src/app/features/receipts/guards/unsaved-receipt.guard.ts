import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '@core/confirm/confirm.service';
import { RECEIPT_LEAVE_CONFIRMATION } from '../constants/receipts.constants';
import type { ReceiptLeaveTarget } from '../models/receipt-upload-page.models';

// Pregunta antes de cerrar la ventana con una revisión sin registrar. Mientras leen o confirman no se
// sale: la respuesta llegaría a un pop-up ya cerrado y la entrada podría quedar a medias.
export const unsavedReceiptGuard: CanDeactivateFn<ReceiptLeaveTarget> = (target) => {
  if (target.busy()) return false;
  if (!target.hasUnsavedChanges()) return true;
  return inject(ConfirmService).ask(RECEIPT_LEAVE_CONFIRMATION);
};
