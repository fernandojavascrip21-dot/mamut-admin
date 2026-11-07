import type { CreateFractionInput, Fraction, FractionActor } from './types'

export async function createFraction(
  _input: CreateFractionInput,
  _actor: FractionActor,
): Promise<{ fraction: Fraction; replayed: boolean }> {
  throw new Error('no implementado')
}

export async function getFraction(_requestId: string): Promise<Fraction> {
  throw new Error('no implementado')
}
