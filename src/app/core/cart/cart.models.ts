// Un renglón del carrito: solo lo que el vendedor eligió. El precio y las piezas que le quedan no se
// guardan, se leen frescos del backend al entrar a las pantallas (spec HU-15 §2).
export interface CartLine {
  productId: number;
  units: number;
}

// Lo que se escribe en localStorage. `version` deja descartar un formato viejo sin romper nada.
// `requestId` es la llave de idempotencia de la venta en curso (HU-16); falta en la versión 1.
export interface StoredCart {
  version: number;
  lines: CartLine[];
  requestId?: string;
}

// Lo que sale de leer y validar lo guardado.
export interface ReadCart {
  lines: CartLine[];
  requestId: string | null;
}
