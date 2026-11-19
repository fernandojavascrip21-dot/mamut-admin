export const STATUS_TITLE = 'Estado del vendedor';

export const DEACTIVATE_HELP =
  'Si ya no trabaja contigo: no podrá entrar a la app, sus ventas y cortes se conservan y le llegará un aviso por correo.';
export const REACTIVATE_HELP =
  'Vuelve a «Mis vendedores», «Viendo» y «Dejar», entra con su contraseña y le llegará un aviso por correo.';
export const CHANGE_PASSWORD_LABEL = 'Cambiar contraseña';
export const CHANGE_PASSWORD_HELP = 'Define una contraseña temporal nueva; le llegará un aviso por correo.';
export const REMOVE_HELP = 'Solo si lo diste de alta por error y nunca tuvo movimientos.';

// Texto de cada botón: normal y mientras corre su acción.
export const STATUS_LABELS = {
  deactivate: { idle: 'Desactivar vendedor', busy: 'Desactivando…' },
  reactivate: { idle: 'Reactivar vendedor', busy: 'Reactivando…' },
  remove: { idle: 'Eliminar vendedor', busy: 'Eliminando…' },
} as const;
