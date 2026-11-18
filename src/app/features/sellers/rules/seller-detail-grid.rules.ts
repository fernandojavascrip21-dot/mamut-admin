import type { DataGridRow } from '@shared/components/data-grid/data-grid.models';
import { NO_REASON_LABEL } from '@shared/components/shrinkage-history-line/shrinkage-history-line.constants';
import { unitsLabel } from '@shared/utils/units-label';
import { OWN_AMOUNT_BADGE } from '../constants/seller-detail-page.constants';
import { DELIVERY_URL, SELLERS_LIST_URL } from '../constants/sellers.constants';
import type {
  DeliveryHistoryItem,
  ReturnHistoryItem,
  SellerStockLine,
  ShrinkageHistoryItem,
} from '../interfaces/seller.models';

// Reglas del grid del detalle de un vendedor: convierten el stock y cada historial del backend en filas
// del grid compartido (`app-data-grid`). En los movimientos el signo dice hacia dónde fueron las piezas
// (+ se le dejó, − se le quitó) y solo los que tienen `requestId` enlazan a su resumen.

// Stock (HU-09/HU-11): piezas sin signo y el precio y costo que le aplican, el propio del vendedor
// (marcado «propio») si el administrador lo fijó o, si no, el general. Tocar la fila corrige sus piezas.
export function stockRows(lines: SellerStockLine[]): DataGridRow[] {
  return lines.map((line) => ({
    key: `stock-${line.productId}`,
    title: line.name,
    image: line.image,
    actionId: String(line.productId),
    actionLabel: `Editar ${line.name}`,
    cells: {
      price: { value: line.unitPrice ?? line.price, badge: line.unitPrice !== null ? OWN_AMOUNT_BADGE : null },
      cost: {
        value: line.unitCostWithShipping ?? line.unitCost,
        badge: line.unitCostWithShipping !== null ? OWN_AMOUNT_BADGE : null,
      },
      units: { value: unitsLabel(line.units) },
    },
  }));
}

// Entregas (HU-11): «+N piezas»; el resumen regresa al vendedor con `?volver=vendedor`.
export function deliveryRows(items: DeliveryHistoryItem[]): DataGridRow[] {
  return items.map((item, index) => ({
    key: `delivery-${index}-${item.requestId ?? item.createdAt}-${item.productId}`,
    title: item.name,
    image: item.image,
    link: item.requestId ? [DELIVERY_URL, item.requestId] : null,
    queryParams: item.requestId ? { volver: 'vendedor' } : null,
    cells: { date: { value: item.createdAt }, units: { value: `+${unitsLabel(item.qty)}` } },
  }));
}

// Retiros (HU-12): «−N piezas»; el resumen vive bajo el vendedor (`/admin/vendedores/<id>/retiros/<requestId>`).
export function returnRows(items: ReturnHistoryItem[], sellerId: string): DataGridRow[] {
  return items.map((item, index) => ({
    key: `return-${index}-${item.requestId ?? item.createdAt}-${item.productId}`,
    title: item.name,
    image: item.image,
    link: item.requestId ? [`${SELLERS_LIST_URL}/${sellerId}/retiros`, item.requestId] : null,
    cells: { date: { value: item.createdAt }, units: { value: `−${unitsLabel(item.qty)}` } },
  }));
}

// Mermas (HU-26): «−N piezas» con su motivo («Sin motivo» si no lo tiene); una merma no tiene resumen.
export function shrinkageRows(items: ShrinkageHistoryItem[]): DataGridRow[] {
  return items.map((item, index) => ({
    key: `shrinkage-${index}-${item.requestId ?? item.createdAt}-${item.product.id}`,
    title: item.product.name,
    image: item.product.image,
    cells: {
      reason: { value: item.reasonLabel ?? NO_REASON_LABEL },
      date: { value: item.createdAt },
      units: { value: `−${unitsLabel(item.qty)}` },
    },
  }));
}

// Texto de una opción del filtro: con el conteo solo cuando la lista ya cargó («Entregas (2)»).
export function sellerDetailOptionLabel(label: string, count: number | null): string {
  return count === null ? label : `${label} (${count})`;
}
