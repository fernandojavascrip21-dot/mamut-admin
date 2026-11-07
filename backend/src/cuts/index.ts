// API pública del módulo de cortes (T-20): calcula el corte de un titular sin guardarlo, con precios
// o para casa (T-22).
export * from './cuts'
export * from './home-cut'
export * from './business-cut'
export { DEFAULT_CUT_PERIOD, DEFAULT_CUT_SCOPE, DEFAULT_CUT_TYPE, BUSINESS_REQUIRES_HOME, BUSINESS_WITHOUT_HOLDER } from './constants'
