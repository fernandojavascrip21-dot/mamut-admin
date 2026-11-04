// Un renglón del carrito: solo lo que el vendedor eligió. El precio y las piezas que le quedan no se
// guardan, se leen frescos del backend al entrar a las pantallas (spec HU-15 §2).
export interface CartLine {
  productId: number;
  units: number;
}

// Lo que se escribe en localStorage. `version` deja descartar un formato viejo sin romper nada.
// `requestId` es la llave de idempotencia de la venta en curso (HU-16); falta en la versión 1.
// `holderId` es el titular del stock del carrito del administrador (HU-17; null = bodega); falta en
// las versiones 1 y 2.
export interface StoredCart {
  version: number;
  lines: CartLine[];
  requestId?: string;
  holderId?: string | null;
}

// Lo que sale de leer y validar lo guardado.
export interface ReadCart {
  lines: CartLine[];
  requestId: string | null;
  holderId: string | null;
}
