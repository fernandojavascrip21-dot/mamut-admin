import { defineConfig, devices } from '@playwright/test';
import { BACKEND_HEALTH_URL, FRONTEND_URL } from './e2e/support/e2e.constants';
import { assertLocalDatabase } from './e2e/support/local-database';

// Antes de arrancar servidores: si backend/.env no apunta a Supabase local, se detiene aquí.
assertLocalDatabase();

// Pruebas de punta a punta contra la app real: Angular en :4200, el backend en :3000 y Supabase
// local (npm run db:start). Un solo worker porque todas comparten la misma base.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: FRONTEND_URL,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    // 375 px: el ancho móvil que piden los criterios de las historias.
    { name: 'movil', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } },
  ],
  // Reusa los servidores si ya están corriendo (npm run dev); si no, los levanta.
  webServer: [
    {
      command: 'npm --prefix backend run dev',
      url: BACKEND_HEALTH_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm start',
      url: FRONTEND_URL,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
