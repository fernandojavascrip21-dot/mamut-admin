// API pública del módulo de pedidos de resurtir (T-36, HU-31): sugerencias, productos pedibles y una
// lista de compra que no mueve inventario. Solo el administrador la usa.
export * from './suggestions'
export * from './products'
export * from './orders'
export type {
  CreateRestockOrderInput, RestockActor, RestockCatalogLineInput, RestockCustomLine, RestockCustomLineInput,
  RestockLineInput, RestockOrder, RestockOrderLine, RestockOrderStatus, RestockOrderSummary, RestockOrdersFilter,
  RestockProduct, RestockSuggestion, UpdateRestockOrderInput,
} from './types'
export { requireLines } from './lines'
export {
  DUPLICATE_CUSTOM, DUPLICATE_PRODUCT, EMPTY_ORDER, LIST_LIMIT, MAX_CUSTOM_NAME_LENGTH, MAX_LINES, MAX_NOTE_LENGTH,
  MAX_QTY, ORDER_CLOSED, ORDER_MISMATCH, PRODUCT_NOT_ORDERABLE,
} from './constants'
