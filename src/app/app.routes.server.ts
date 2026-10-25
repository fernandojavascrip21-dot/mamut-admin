import { RenderMode, ServerRoute } from '@angular/ssr';

// /cuenta, /admin y /vendedor dependen de roleGuard, que lee la sesión de localStorage — el
// servidor nunca la ve, así que renderizarlas ahí evaluaría el guard como "sin sesión" y
// mandaría a /login en cada recarga aunque el usuario real sí tenga sesión (encontrado en la
// verificación manual de M0, criterio 7 del Plan de pruebas: specs/M0-base/spec.md §7).
// Se resuelven solo en el cliente, que es quien de verdad conoce la sesión.
export const serverRoutes: ServerRoute[] = [
  { path: 'cuenta', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'vendedor', renderMode: RenderMode.Client },
  { path: 'vendedor/**', renderMode: RenderMode.Client },
  // login depende de guestGuard (HU-03, criterio 5), que también lee localStorage: mismo
  // motivo que las rutas de arriba.
  { path: 'login', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
