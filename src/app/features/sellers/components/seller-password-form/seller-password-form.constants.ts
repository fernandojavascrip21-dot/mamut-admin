export const PASSWORD_FORM_TEXTS = {
  passwordLabel: 'Contraseña temporal',
  confirmationLabel: 'Confirmar contraseña',
  hint: 'Mínimo 8 caracteres. Dísela en persona al vendedor.',
  submit: 'Cambiar contraseña',
  saving: 'Cambiando…',
  cancel: 'Cancelar',
} as const;

export const PASSWORD_FIELD_MESSAGES = {
  passwordRequired: 'Escribe la contraseña temporal',
  passwordShort: 'Usa al menos 8 caracteres',
  confirmationRequired: 'Confirma la contraseña',
  mismatch: 'Las contraseñas no coinciden',
} as const;

export const INVALID_INPUT_PT = { pcInputText: { root: { 'aria-invalid': 'true' } } };
