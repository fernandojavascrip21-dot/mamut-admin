// Un renglón del carrito: solo lo que el vendedor eligió. El precio y las piezas que le quedan no se
// guardan, se leen frescos del backend al entrar a las pantallas (spec HU-15 §2).
export interface CartLine {
  productId: number;
  units: number;
}

// Lo que se escribe en localStorage. `version` deja descartar un formato viejo sin romper nada.
export interface StoredCart {
  version: number;
  lines: CartLine[];
}
