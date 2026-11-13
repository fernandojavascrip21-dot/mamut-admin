import type { CanDeactivateFn } from '@angular/router';
import type { ReceiptLeaveTarget } from '../models/receipt-upload-page.models';

// Pendiente de implementar (HU-42).
export const unsavedReceiptGuard: CanDeactivateFn<ReceiptLeaveTarget> = () => {
  throw new Error('No implementado');
};
