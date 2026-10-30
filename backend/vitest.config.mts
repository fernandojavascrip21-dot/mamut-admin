import { defineConfig } from 'vitest/config'

// Las pruebas usan la base real de DATABASE_URL (ver "Identified risks" del SPEC 05).
try {
  process.loadEnvFile('.env')
} catch {
  // sin .env: se usa lo que ya haya en el entorno
}

export default defineConfig({
  // Los alias de imports (@db/*, @lib/*, @auth, @api/*…) se leen de tsconfig.json, igual que Next.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    fileParallelism: false,
  },
})
