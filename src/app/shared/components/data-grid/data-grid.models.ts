// Grid reutilizable: una tabla con filtro opcional que pinta la lista elegida con sus estados de
// carga, error y vacío. No conoce el negocio: la página arma columnas, filas y textos.

// Estado de la lista que se está pintando.
export type DataGridState = 'loading' | 'error' | 'ready';

// Opción del filtro (`p-selectbutton`); sin opciones, el grid no muestra filtro.
export interface DataGridOption {
  label: string;
  value: string;
}

// Cómo se pinta el valor de una celda: texto tal cual, fecha `dd/MM/yyyy HH:mm`, precio (2
// decimales) o costo (hasta 4). Los montos llegan como texto y solo se convierten para el pipe.
export type DataGridCellFormat = 'text' | 'date' | 'money' | 'cost';

// Una columna además de la primera (foto y título de la fila). `primary` se ve también en móvil;
// las demás bajan bajo el título en pantallas chicas para que la tabla no haga scroll horizontal.
export interface DataGridColumn {
  key: string;
  header: string;
  align: 'left' | 'right';
  format: DataGridCellFormat;
  primary?: boolean;
}

// Valor de una celda y, si aplica, una marca corta junto a él («propio»).
export interface DataGridCell {
  value: string | null;
  badge?: string | null;
}

// Una fila. Con `actionId` toda la fila es tocable y el grid emite ese id (su título es un botón con
// `actionLabel` como nombre accesible); con `link`, el título es un enlace; sin ninguno, solo texto.
export interface DataGridRow {
  key: string;
  title: string;
  image: string | null;
  cells: Record<string, DataGridCell>;
  link?: string[] | null;
  queryParams?: Record<string, string> | null;
  actionId?: string | null;
  actionLabel?: string | null;
}

// Textos de la lista pintada. `stateClass` da las clases `<stateClass>-loading`, `-error` y
// `retry-<stateClass>`; `emptyClass` la del mensaje vacío.
export interface DataGridTexts {
  titleHeader: string;
  loading: string;
  error: string;
  empty: string;
  stateClass: string;
  emptyClass: string;
}
