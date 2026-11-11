import { MONEY_MAX } from '@shared/constants/money.constants';
import { compareMoney, fromMinorUnits, toMinorUnits } from '@shared/utils/money';
import type { RestockLineForm } from '../components/restock-form/restock-form.models';
import { MAX_QTY, RESTOCK_QTY_PATTERN } from '../constants/restock.constants';
import type { RestockEstimate } from '../models/restock-page.models';

// Piezas válidas (entero de 1 a MAX_QTY): un renglón con otra cosa no suma.
function parseQty(value: string): bigint | null {
  const text = value.trim();
  if (!RESTOCK_QTY_PATTERN.test(text) || Number(text) > MAX_QTY) return null;
  return BigInt(text);
}

// Costo en diezmilésimas como entero exacto; null si no es un costo válido (formato o tope).
function parseCost(value: string): bigint | null {
  const text = value.trim();
  const order = compareMoney(text, 4, MONEY_MAX[4], 4);
  if (order === null || order > 0) return null;
  const units = toMinorUnits(text, 4);
  return units === null ? null : BigInt(units);
}

// Total estimado: piezas × costo de cada renglón se suma en enteros (diezmilésimas) y el redondeo a
// centavos (mitad hacia arriba) se hace una sola vez, sobre la suma. Un costo de catálogo inválido o
// vacío no suma; uno escrito a mano vacío cuenta 0 y se reporta como «sin costo».
export function estimateTotal(lines: RestockLineForm[]): RestockEstimate {
  let tenThousandths = 0n;
  let withoutCost = 0;
  for (const line of lines) {
    const isBlankCost = line.unitCost.trim() === '';
    if (line.kind === 'custom' && isBlankCost) {
      withoutCost += 1;
      continue;
    }
    const qty = parseQty(line.qty);
    const cost = parseCost(line.unitCost);
    if (qty === null || cost === null) continue;
    tenThousandths += qty * cost;
  }
  const cents = (tenThousandths + 50n) / 100n;
  return { total: fromMinorUnits(Number(cents), 2), withoutCost };
}
