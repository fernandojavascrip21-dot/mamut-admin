import type { CanDeactivateFn } from '@angular/router';
import type { EditSellerLeaveTarget } from '../models/edit-seller-page.models';

export const unsavedSellerGuard: CanDeactivateFn<EditSellerLeaveTarget> = () => true;
