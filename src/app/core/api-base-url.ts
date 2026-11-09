// URL del backend. El valor sale de API_BASE_URL (.env o entorno) vía npm run api:prepare;
// este archivo es la única puerta de entrada, así que ningún módulo importa el generado directamente.
export { API_BASE_URL } from './api-base-url.generated';
