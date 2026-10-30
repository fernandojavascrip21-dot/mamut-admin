import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { corsHeaders } from '@lib/cors'

// Aplica CORS a toda la API: responde el preflight y agrega las cabeceras a las respuestas.
// Un origen que no está en ALLOWED_ORIGINS no recibe cabeceras CORS (el navegador lo bloquea).
export function proxy(request: NextRequest) {
  const headers = corsHeaders(request.headers.get('origin'))

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: headers ? 204 : 403, headers: headers ?? {} })
  }

  const response = NextResponse.next()
  if (headers) for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
  return response
}

export const config = {
  matcher: '/api/:path*',
}
