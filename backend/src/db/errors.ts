// Código SQLSTATE de un error de Postgres (Drizzle lo envuelve en `cause`).
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null
  const code = e?.code ?? e?.cause?.code
  return typeof code === 'string' ? code : undefined
}

export const isUniqueViolation = (err: unknown) => pgErrorCode(err) === '23505'
export const isForeignKeyViolation = (err: unknown) => pgErrorCode(err) === '23503'

// Nombre del constraint que violó el error (postgres.js lo expone como `constraint_name`).
export function pgConstraintName(err: unknown): string | undefined {
  const e = err as { constraint_name?: unknown; cause?: { constraint_name?: unknown } } | null
  const name = e?.constraint_name ?? e?.cause?.constraint_name
  return typeof name === 'string' ? name : undefined
}

// `constraint` filtra por nombre, para distinguir un check de negocio de otro que sería un bug.
export const isCheckViolation = (err: unknown, constraint?: string) =>
  pgErrorCode(err) === '23514' && (constraint === undefined || pgConstraintName(err) === constraint)
