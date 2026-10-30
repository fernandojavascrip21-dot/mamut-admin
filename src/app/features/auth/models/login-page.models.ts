import type { FormControl, FormGroup } from '@angular/forms';

export type LoginState = 'form' | 'loading' | 'error-credentials' | 'offline';

export type LoginFormGroup = FormGroup<{
  email: FormControl<string>;
  password: FormControl<string>;
}>;

// Cuerpo de POST /api/auth/login (AuthService.login).
export interface LoginPayload {
  email: string;
  password: string;
}
