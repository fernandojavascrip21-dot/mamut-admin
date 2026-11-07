// Forma del formulario: las bolsitas van como texto y se validan como entero 2..1000.
export interface FractionFormValue {
  productId: number | null;
  portions: string;
  price: string;
}

// Errores del servidor que la página pinta en cada campo del formulario.
export interface FractionServerErrors {
  product?: string | null;
  portions?: string | null;
  price?: string | null;
}

// Lo que emite el formulario; el requestId lo agrega la página.
export interface FractionFormSubmit {
  productId: number;
  portions: number;
  price: string;
}
