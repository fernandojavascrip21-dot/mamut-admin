import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MONEY_MAX } from '@shared/constants/money.constants';
import { normalizeText } from '@shared/utils/normalize-text';
import { compareMoney } from '@shared/utils/money';
import { MAX_CUSTOM_NAME_LENGTH, MAX_NOTE_LENGTH, MAX_QTY, RESTOCK_QTY_PATTERN } from '../constants/restock.constants';

// Texto del control, o vacío si no es texto (los controles de la lista siempre lo son).
function textOf(control: AbstractControl): string {
  return typeof control.value === 'string' ? control.value.trim() : '';
}

// Piezas: vacío → `required`; decimal, 0, negativo o texto → `integer`; más del tope → `tooLarge`.
export function restockQty(): ValidatorFn {
  return (control): ValidationErrors | null => {
    const text = textOf(control);
    if (text === '') return { required: true };
    if (!RESTOCK_QTY_PATTERN.test(text)) return { integer: true };
    return Number(text) > MAX_QTY ? { tooLarge: true } : null;
  };
}

// Costo unitario: hasta 4 decimales, de 0 a 999999.9999. Vacío → `required` solo si `required`.
// Más decimales, negativo, fuera de rango o texto → `cost`. Va en texto para no perder precisión.
export function restockUnitCost(options: { required: boolean }): ValidatorFn {
  return (control): ValidationErrors | null => {
    const text = textOf(control);
    if (text === '') return options.required ? { required: true } : null;
    const order = compareMoney(text, 4, MONEY_MAX[4], 4);
    return order === null || order > 0 ? { cost: true } : null;
  };
}

// Nombre escrito a mano: recortado de 1 a 120 caracteres → `required` / `maxlength`. Se cuentan
// caracteres, no unidades UTF-16, para coincidir con el `char_length` del backend.
export function restockCustomName(): ValidatorFn {
  return (control): ValidationErrors | null => {
    const text = textOf(control);
    if (text === '') return { required: true };
    return [...text].length > MAX_CUSTOM_NAME_LENGTH ? { maxlength: true } : null;
  };
}

// Nota: hasta 500 caracteres (recortada, como se manda) → `maxlength`.
export function restockNote(): ValidatorFn {
  return (control): ValidationErrors | null =>
    [...textOf(control)].length > MAX_NOTE_LENGTH ? { maxlength: true } : null;
}

// Posiciones de los nombres que ya aparecieron antes (sin mayúsculas ni acentos); los vacíos no cuentan.
// Es la validación de «Ya escribiste este producto», que se marca en la primera aparición repetida.
export function duplicateNameIndexes(names: string[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  names.forEach((name, index) => {
    const key = normalizeText(name);
    if (key === '') return;
    if (seen.has(key)) duplicates.push(index);
    else seen.add(key);
  });
  return duplicates;
}
