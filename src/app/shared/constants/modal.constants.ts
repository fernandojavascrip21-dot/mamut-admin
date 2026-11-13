// Outlet con nombre donde `admin-shell` muestra los pop-ups de «Dejar» y «Retirar» (spec T-16). Sus
// rutas viven en `core/layout/routes/admin.routes.ts`.
export const MODAL_OUTLET = 'ventana';

// Rutas del outlet: `dejar` (con los parámetros matriciales opcionales `vendedor` y `producto`),
// `retirar/:sellerId` y `editar/:sellerId/:productId` (corregir lo ya dejado).
export const MODAL_DELIVERY_PATH = 'dejar';
export const MODAL_RETURN_PATH = 'retirar';
export const MODAL_EDIT_HOLDING_PATH = 'editar';
// Ventana «Fraccionar» (HU-23): con el parámetro matricial opcional `producto`.
export const MODAL_FRACTION_PATH = 'fraccionar';
// Ventana «Registrar merma» (HU-25): con el parámetro matricial opcional `vendedor`.
export const MODAL_SHRINKAGE_PATH = 'merma';
// Ventana «Entrada a bodega» (HU-27): sin parámetros.
export const MODAL_PURCHASE_PATH = 'entrada';
// Ventana «Lista de resurtir» (HU-31): sin parámetros.
export const MODAL_RESTOCK_PATH = 'resurtir';
// Ventanas «Pedidos anteriores» (`resurtir/pedidos`) y su detalle (`resurtir/pedidos/:id`) (HU-32).
export const MODAL_RESTOCK_HISTORY_PATH = 'resurtir/pedidos';
// Ventana «Cargar remisión» (HU-42): sin parámetros.
export const MODAL_RECEIPT_PATH = 'remision';
