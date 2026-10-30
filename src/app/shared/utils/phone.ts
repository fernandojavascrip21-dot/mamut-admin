import { TEN_DIGITS } from '../constants/phone.constants';

// Formato único para MOSTRAR un teléfono ya registrado en cualquier pantalla: «55 2468 1357»
// (2-4-4). Solo es presentación: en la base y en la API el teléfono va con sus 10 dígitos
// seguidos, y lo que la persona escribe en un campo no se reformatea. Un valor que no son
// 10 dígitos se devuelve tal cual; null o vacío da ''.
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return '';
  return TEN_DIGITS.test(digits) ? `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}` : digits;
}
