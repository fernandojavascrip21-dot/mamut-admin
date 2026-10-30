// Vendedor tal como lo devuelve el backend (`AccountView` con rol 'vendedor'). `phone` viene
// solo con dígitos (10), porque así lo guarda la base (spec T-10).
export interface Seller {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  active: boolean;
}

// Cuerpo de POST /api/sellers. El «usuario» del vendedor es su correo (spec T-10).
export interface CreateSellerInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}

export type CreateSellerFailure = 'duplicate-email' | 'invalid' | 'offline';

// Resultado de SellerSaveService: la página decide qué pintar sin leer HttpErrorResponse.
// `message` trae el texto del backend en un 422 (p. ej. «El teléfono debe tener 10 dígitos»).
export type CreateSellerResult =
  | { ok: true; seller: Seller }
  | { ok: false; reason: CreateSellerFailure; message?: string };
