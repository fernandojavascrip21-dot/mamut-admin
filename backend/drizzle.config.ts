import { defineConfig } from 'drizzle-kit'

// drizzle-kit no lee .env por sí solo; Node lo carga con loadEnvFile.
try {
  process.loadEnvFile('.env')
} catch {
  // sin .env: se usa lo que ya haya en el entorno
}

// Drizzle solo introspecciona (`drizzle-kit pull`): el esquema se migra con
// supabase/migrations/ en el repo del frontend. No usar `generate` ni `push`.
export default defineConfig({
  dialect: 'postgresql',
  out: './src/db',
  schema: './src/db/schema.ts',
  schemaFilter: ['public'],
  dbCredentials: { url: process.env.DATABASE_URL! },
})
