import { PHONE_SEPARATORS, TEN_DIGITS } from '@shared/constants/phone.constants';
import { sortByName } from '@shared/utils/sort-by-name';
import type { SellerSummary } from '../interfaces/seller.models';

// Deja el teléfono solo con dígitos si lo que escribió la persona son 10 dígitos con espacios,
// guiones o paréntesis («55 2468 1357», «(55) 2468 1357»); si no, null. Mismo contrato que
// `normalizePhone` del backend (`backend/src/accounts/sellers.ts`), que ahí responde 422.
// Para MOSTRAR un teléfono ya guardado se usa el pipe `phone` (`shared/pipes/phone.pipe.ts`).
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(PHONE_SEPARATORS, '');
  return TEN_DIGITS.test(digits) ? digits : null;
}

// Orden de «Mis vendedores» (HU-09): alfabético sin acentos, con la misma regla que la barra
// «Viendo» (`shared/utils/sort-by-name.ts`). Devuelve una copia.
export function sortSellersByName(sellers: SellerSummary[]): SellerSummary[] {
  return sortByName(sellers);
}

// Texto de piezas de un vendedor: «1 pieza» o «N piezas» (también «0 piezas»).
export function unitsLabel(units: number): string {
  return units === 1 ? '1 pieza' : `${units} piezas`;
}
