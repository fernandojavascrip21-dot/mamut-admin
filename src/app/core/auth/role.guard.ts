import { inject } from '@angular/core';
import { CanMatchFn, Route, Router } from '@angular/router';
import { AuthService } from './auth.service';
import type { AuthContext } from './auth.models';

// A dónde manda el guard cuando el rol de quien entra no es el que la ruta permite.
// Un rol sin entrada aquí (p. ej. 'client', ajeno a este frontend) cae al login.
export const ROLE_HOME: Partial<Record<AuthContext['role'], string>> = {
  admin: '/admin',
  vendedor: '/vendedor',
};

// Exige sesión válida; si la ruta declara `data: { roles: [...] }`, exige además que el rol
// de quien entra esté en esa lista. Sin sesión -> /login. Rol equivocado -> la home del propio
// rol (o /login si el rol no tiene una home conocida en este frontend, como 'client').
export const roleGuard: CanMatchFn = (route: Route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) return router.createUrlTree(['/login']);

  const allowedRoles = route.data?.['roles'] as AuthContext['role'][] | undefined;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return router.createUrlTree([ROLE_HOME[user.role] ?? '/login']);
  }

  return true;
};
