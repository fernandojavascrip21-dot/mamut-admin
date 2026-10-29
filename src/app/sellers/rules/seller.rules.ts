import { PHONE_SEPARATORS, TEN_DIGITS } from '../constants/seller.constants';

// Deja el teléfono solo con dígitos si lo que escribió la persona son 10 dígitos con espacios,
// guiones o paréntesis («55 2468 1357», «(55) 2468 1357»); si no, null. Mismo contrato que
// `normalizePhone` del backend (`backend/src/accounts/sellers.ts`), que ahí responde 422.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(PHONE_SEPARATORS, '');
  return TEN_DIGITS.test(digits) ? digits : null;
}

// Teléfono guardado (10 dígitos) en el formato en que se lee en voz alta: «55 2468 1357».
// Cualquier otro valor se devuelve tal cual.
export function formatPhone(digits: string): string {
  return TEN_DIGITS.test(digits) ?`${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}` : digits;
}
