// Código SQLSTATE de un error de Postgres (Drizzle lo envuelve en `cause`).
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null
  const code = e?.code ?? e?.cause?.code
  return typeof code === 'string' ? code : undefined
}

export const isUniqueViolation = (err: unknown) => pgErrorCode(err) === '23505'
export const isForeignKeyViolation = (err: unknown) => pgErrorCode(err) === '23503'
