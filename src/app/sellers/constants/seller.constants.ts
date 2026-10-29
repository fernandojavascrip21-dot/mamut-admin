// Lo que se quita al escribir un teléfono («55 2468 1357», «(55) 2468 1357») y el formato que
// queda guardado: 10 dígitos (spec T-10). Mismo contrato que backend/src/accounts/constants.ts.
export const PHONE_SEPARATORS = /[\s\-()]/g;
export const TEN_DIGITS = /^[0-9]{10}$/;
