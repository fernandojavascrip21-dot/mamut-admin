import type { MoneyScale } from '../money';

// Máximo de cada columna: numeric(10,2) para precios y numeric(10,4) para costos (spec T-08).
export const MONEY_MAX: Record<MoneyScale, string> = { 2: '99999999.99', 4: '999999.9999' };

// Texto decimal sin signo, comas ni notación científica: «450», «450.50».
export const DECIMAL = /^(\d+)(?:\.(\d+))?$/;
