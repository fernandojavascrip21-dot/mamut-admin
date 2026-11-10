import type { ValidationErrors, ValidatorFn } from '@angular/forms';

// Piezas: vacío → `required`; decimal, 0, negativo o texto → `integer`; más del tope → `tooLarge`.
export function restockQty(): ValidatorFn {
  return (): ValidationErrors | null => ({ pending: true });
}

// Costo unitario: hasta 4 decimales, de 0 a 999999.9999. Vacío → `required` solo si `required`.
// Más decimales, negativo, fuera de rango o texto → `cost`.
export function restockUnitCost(options: { required: boolean }): ValidatorFn {
  void options;
  return (): ValidationErrors | null => ({ pending: true });
}

// Nombre escrito a mano: recortado de 1 a 120 caracteres → `required` / `maxlength`.
export function restockCustomName(): ValidatorFn {
  return (): ValidationErrors | null => ({ pending: true });
}

// Nota: hasta 500 caracteres → `maxlength`.
export function restockNote(): ValidatorFn {
  return (): ValidationErrors | null => ({ pending: true });
}

// Posiciones de los nombres que ya aparecieron antes (sin mayúsculas ni acentos); los vacíos no cuentan.
export function duplicateNameIndexes(names: string[]): number[] {
  void names;
  return [-1];
}
