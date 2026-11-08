// Forma del formulario: las piezas son texto mientras se escriben; el payload las convierte.
export interface ShrinkageFormValue {
  productId: number | null;
  qty: string;
  reason: string;
}

// Lo que emite el formulario; el requestId y el titular los agrega la página.
export interface ShrinkageFormSubmit {
  productId: number;
  qty: number;
  reason: string;
}

// Errores del servidor que la página pinta en un campo.
export interface ShrinkageServerErrors {
  qty?: string | null;
}
