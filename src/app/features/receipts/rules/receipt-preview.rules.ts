import { compareMoney } from '@shared/utils/money';
import type { ReceiptLineFormValue } from '../components/receipt-preview-form/receipt-preview-form.models';
import { MAX_QTY, QTY_DIGITS } from '../constants/receipts.constants';
import type {
  ConfirmReceiptPayload, PreviewLine, ReceiptCatalogItem, ReceiptPreview, ReceiptSource,
} from '../interfaces/receipt.models';

// Anticipa lo que decidirá el backend al confirmar (HU-42). Son funciones puras: la pantalla las usa
// para mostrar el stock «antes → después» y el aviso de costo; el backend vuelve a calcular todo.

// Piezas de bodega antes de la entrada. La vista previa lo trae para los productos que empareja; si el
// administrador eligió un producto a mano, no viene y se toma el stock del catálogo.
export function stockBefore(productId: number, preview: ReceiptPreview, catalog: ReceiptCatalogItem[]): number {
  const fromPreview = preview.stock.find((entry) => entry.productId === productId);
  if (fromPreview) return fromPreview.before;
  return catalog.find((product) => product.id === productId)?.units ?? 0;
}

// Antes más las piezas de todos los renglones de ese producto. Un renglón con piezas que no son un
// entero válido no suma: su error ya lo muestra el formulario.
export function stockAfter(
  productId: number,
  preview: ReceiptPreview,
  catalog: ReceiptCatalogItem[],
  lines: ReceiptLineFormValue[],
): number {
  const added = lines
    .filter((line) => line.productId === String(productId))
    .reduce((sum, line) => sum + (validQty(line.qty) ?? 0), 0);
  return stockBefore(productId, preview, catalog) + added;
}

// Costo distinto al actual del producto. Sin costo, sin producto o un costo que no es monto válido no
// cuenta como cambio: el error de formato lo muestra el validador, no este aviso.
export function costChanged(line: ReceiptLineFormValue, product: ReceiptCatalogItem | null): boolean {
  if (!product || line.unitCost.trim() === '') return false;
  const comparison = compareMoney(line.unitCost.trim(), 4, product.unitCost, 4);
  return comparison !== null && comparison !== 0;
}

// Arma el cuerpo de confirmar. `values` y `proposed` van en paralelo: un renglón quitado de la pantalla
// sale de `values` y del `proposed` correspondiente. «Producto nuevo» y costo vacío viajan como null.
export function buildConfirmPayload(params: {
  requestId: string;
  source: ReceiptSource;
  fileName: string | null;
  proposed: PreviewLine[];
  values: ReceiptLineFormValue[];
}): ConfirmReceiptPayload {
  const lines = params.values.flatMap((value, index) => {
    const line = params.proposed[index];
    if (!line) return [];
    const unitCost = value.unitCost.trim();
    return [{
      readName: line.readName,
      qty: Number(value.qty.trim()),
      unitCost: unitCost === '' ? null : unitCost,
      productId: value.productId === '' ? null : Number(value.productId),
    }];
  });
  return { requestId: params.requestId, source: params.source, fileName: params.fileName, lines };
}

// Piezas válidas como número: entero de 1 al tope; cualquier otra cosa devuelve null. Se exporta para
// sumar las piezas de la barra con la misma regla que el validador.
export function validQty(value: string): number | null {
  const text = value.trim();
  if (!QTY_DIGITS.test(text)) return null;
  const qty = Number(text);
  return qty >= 1 && qty <= MAX_QTY ? qty : null;
}
