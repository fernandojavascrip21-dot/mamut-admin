import type { FormControl, FormGroup } from '@angular/forms';

export type LoginState = 'form' | 'loading' | 'error-credentials' | 'offline';

export type LoginFormGroup = FormGroup<{
  email: FormControl<string>;
  password: FormControl<string>;
  remember: FormControl<boolean>;
}>;

// Datos de AuthService.login: email y password son el cuerpo de POST /api/auth/login;
// «remember» solo decide dónde se guarda la sesión y no viaja al backend.
export interface LoginPayload {
  email: string;
  password: string;
  remember: boolean;
}
