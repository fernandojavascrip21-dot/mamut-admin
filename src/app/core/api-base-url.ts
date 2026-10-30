// URL del backend (mammut-api, Next.js). Las llamadas van cross-origin vía CORS
// (backend/.env ALLOWED_ORIGINS), no por un proxy del dev server de Angular.
// La URL de producción queda fuera de este spec (ver "Despliegue y CI/CD").
export const API_BASE_URL = 'http://localhost:3000';
