// CORS por lista de orígenes (ALLOWED_ORIGINS, separados por coma). La sesión viaja en
// `Authorization: Bearer`, así que no se usan cookies ni `Access-Control-Allow-Credentials`.
export function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

// Cabeceras CORS para un origen permitido; `null` si el origen no está en la lista.
export function corsHeaders(origin: string | null): Record<string, string> | null {
  if (!origin || !allowedOrigins().includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}
