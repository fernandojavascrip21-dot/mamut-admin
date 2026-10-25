import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROLE_HOME } from './role.guard';

// Evita que alguien con sesión activa vuelva a ver el formulario de login al reabrir la app
// o recargar /login: lo manda directo a la home de su rol. Sin sesión, deja pasar (criterio 5
// de HU-03). No valida el token contra el backend, igual que roleGuard: si expiró o el perfil
// se desactivó, el interceptor existente lo detecta en la primera petición real.
export const guestGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) return true;

  return router.createUrlTree([ROLE_HOME[user.role] ?? '/login']);
};
