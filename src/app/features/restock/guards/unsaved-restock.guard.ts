import type { CanDeactivateFn } from '@angular/router';
import type { RestockLeaveTarget } from '../models/restock-page.models';

// Pregunta antes de salir de la lista de resurtir con cambios sin guardar; mientras hay un envío no se sale.
export const unsavedRestockGuard: CanDeactivateFn<RestockLeaveTarget> = () => true;
