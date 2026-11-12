// API pública del módulo de remisiones del proveedor (T-41): leer una remisión y registrar la entrada.
export * from './normalize'
export * from './access'
export type {
  CostStatus,
  MatchKind,
  PendingCostChange,
  PendingNewProduct,
  PendingReceiptLines,
  PreviewLine,
  Receipt,
  ReceiptActor,
  ReceiptLine,
  ReceiptLineStatus,
  ReceiptPreview,
  ReceiptSource,
  SkipReason,
} from './types'
