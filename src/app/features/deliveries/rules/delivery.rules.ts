import { MONEY_MAX } from '@shared/constants/money.constants';
import { compareMoney, fromMinorUnits, toMinorUnits, type MoneyScale } from '@shared/utils/money';
import { normalizeText } from '@shared/utils/normalize-text';
import {
  DEFAULT_RETURN_TARGET,
  PRODUCTS_URL,
  RETURN_TARGETS,
  SELLERS_URL,
} from '../constants/deliveries.constants';
import type { DeliveryProductSummary } from '../interfaces/delivery.models';
import type { ReturnTarget } from '../models/create-delivery-page.models';

// Un monto escrito cuenta como «propio» solo si es un decimal válido de esa escala, mayor a 0 y
// dentro de la columna. Si no, la ventana muestra el error al enviar y mientras tanto usa el general.
function validOwnMoney(own: string | null, scale: MoneyScale): string | null {
  const text = own?.trim() ?? '';
  const units = text === '' ? null : toMinorUnits(text, scale);
  if (units === null || units <= 0 || compareMoney(text, scale, MONEY_MAX[scale], scale) === 1)
    return null;
  return text;
}

// Precio de venta que aplica a las piezas del vendedor: el propio si hay, si no el general (RF-26).
export function effectivePrice(general: string, own: string | null): string {
  return validOwnMoney(own, 2) ?? general;
}

// Costo que aplica: el costo con envío propio si hay, si no el de fábrica (RF-27).
export function effectiveCost(factory: string, own: string | null): string {
  return validOwnMoney(own, 4) ?? factory;
}

// Ganancia por pieza = precio − costo, calculada en diezmilésimas y redondeada a centavos una sola
// vez al final, mitad hacia arriba (convención de dinero de CLAUDE.md). Puede ser negativa.
export function profitPerUnit(price: string, cost: string): string {
  const priceUnits = toMinorUnits(price, 2);
  const costUnits = toMinorUnits(cost, 4);
  if (priceUnits === null || costUnits === null) return '0.00';
  const difference = priceUnits * 100 - costUnits;
  return fromMinorUnits(Math.floor((difference + 50) / 100), 2);
}

// true si el precio queda por debajo del costo: la ventana lo avisa pero deja confirmar (HU-11).
export function isBelowCost(price: string, cost: string): boolean {
  return compareMoney(price, 2, cost, 4) === -1;
}

// Saldos después de dejar `qty` piezas: la bodega baja y el vendedor sube; el total no cambia.
export function previewBalances(
  warehouse: number,
  seller: number,
  qty: number,
): { warehouse: number; seller: number } {
  return { warehouse: warehouse - qty, seller: seller + qty };
}

// Productos que se pueden dejar: activos (el backend ya los filtra) con piezas en la bodega, cuyo
// nombre contiene la búsqueda sin distinguir mayúsculas ni acentos. Búsqueda vacía = todos.
export function filterDeliverableProducts(
  products: DeliveryProductSummary[],
  query: string,
): DeliveryProductSummary[] {
  const normalizedQuery = normalizeText(query);
  return products.filter(
    (product) =>
      product.stock > 0 &&
      (normalizedQuery === '' || normalizeText(product.name).includes(normalizedQuery)),
  );
}

// El parámetro `volver` de la URL, validado: solo los valores conocidos; el resto, «productos».
export function parseReturnTarget(raw: string | null): ReturnTarget {
  return RETURN_TARGETS.find((target) => target === raw) ?? DEFAULT_RETURN_TARGET;
}

// URL a la que regresa «Cancelar» o «Listo». Sin vendedor conocido, «vendedor» cae en la lista.
export function returnUrl(target: ReturnTarget, sellerId: string | null): string {
  if (target === 'vendedor') return sellerId ? `${SELLERS_URL}/${sellerId}` : SELLERS_URL;
  return PRODUCTS_URL;
}

// El parámetro `producto` de la URL: un entero positivo, o null si falta o no lo es.
export function parseProductId(raw: string | null): number | null {
  return raw !== null && /^[1-9]\d{0,14}$/.test(raw) ? Number(raw) : null;
}
