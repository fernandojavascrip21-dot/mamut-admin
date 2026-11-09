// Contratos de la pantalla «Registrar merma» (HU-25); espejo de lo que manda el backend.
export interface ShrinkageOption {
  productId: number;
  name: string;
  image: string | null;
  units: number;
}

export interface ShrinkageReasonOption {
  code: string;
  label: string;
}

export interface ShrinkageOptions {
  holder: { id: string; fullName: string } | null; // null = bodega
  products: ShrinkageOption[];
  reasons: ShrinkageReasonOption[];
}

// Respuesta de POST /api/shrinkages (T-25 §4).
export interface Shrinkage {
  requestId: string;
  createdAt: string;
  qty: number;
  reason: string;
  reasonLabel: string;
  holder: { id: string; fullName: string } | null;
  product: { id: number; name: string; image: string | null };
  stock: { before: number; after: number };
}

export interface CreateShrinkagePayload {
  requestId: string;
  holderProfileId: string | null;
  productId: number;
  qty: number;
  reason: string;
}

export type ShrinkageFailureReason = 'no-units' | 'conflict' | 'not-found' | 'offline';

export type ShrinkageResult =
  | { ok: true; shrinkage: Shrinkage; replayed: boolean }
  | { ok: false; reason: ShrinkageFailureReason; message: string | null };
