// Zona horaria con la que se cortan los días, semanas y meses (spec T-20 §2).
export const CUT_TIME_ZONE = 'America/Mexico_City'

// Periodos que admite el corte.
export const CUT_PERIODS = ['day', 'week', 'month'] as const

// Periodo cuando la petición no trae `period`.
export const DEFAULT_CUT_PERIOD = 'day'

// Formato de `date`; la fecha real se valida aparte (2026-02-30 no existe).
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// 422 cuando `period` no es day, week ni month.
export const INVALID_PERIOD = 'El periodo debe ser day, week o month'

// 422 cuando `date` no es una fecha YYYY-MM-DD real.
export const INVALID_DATE = 'La fecha debe tener el formato YYYY-MM-DD y existir'

// Tipos de corte (T-22): con precios (el del vendedor, T-20) y para casa (costo de fábrica).
export const CUT_TYPES = ['prices', 'home'] as const

// Tipo cuando la petición no trae `type`: el corte con precios de siempre.
export const DEFAULT_CUT_TYPE = 'prices'

// 422 cuando `type` no es prices ni home.
export const INVALID_CUT_TYPE = 'El tipo de corte debe ser prices o home'
