import { validation } from '../lib/errors'
import { createAccount, type AccountView } from './accounts'
import { PHONE_SEPARATORS, TEN_DIGITS } from './constants'

export type SellerView = AccountView

// Acepta el teléfono como lo escribe una persona («55 2468 1357», «55-2468-1357»,
// «(55) 2468 1357») y lo deja solo con dígitos, que es lo único que acepta la base (spec T-10).
// «+52» o letras no se limpian: quedan fuera de los 10 dígitos y dan 422. Mismo contrato que
// `normalizePhone` del frontend (`src/app/sellers/rules/seller.rules.ts`).
export function normalizePhone(raw: string): string {
  const digits = raw.replace(PHONE_SEPARATORS, '')
  if (!TEN_DIGITS.test(digits)) throw validation('El teléfono debe tener 10 dígitos')
  return digits
}

// Alta de vendedor (HU-08): misma cuenta en dos pasos que cualquier login (createAccount, con su
// compensación si falla `profiles`), con rol 'vendedor' y teléfono normalizado. El teléfono se
// valida antes de tocar Supabase Auth, para no crear un usuario que luego haya que borrar.
export function createSeller(input: { email: string; password: string; fullName: string; phone: string }): Promise<SellerView> {
  const phone = normalizePhone(input.phone)
  return createAccount(
    { email: input.email, password: input.password, fullName: input.fullName },
    { role: 'vendedor', clientId: null, active: true, phone },
  )
}
