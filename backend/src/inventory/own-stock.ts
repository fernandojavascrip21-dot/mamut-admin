import { lowStockLines, stockOfHolder, type StockLevel } from '@stock'

// Un producto del stock propio del vendedor (HU-14): solo lo que él puede ver (RNF-04).
// `price` ya viene resuelto: el precio propio (vendor_stock.unit_price) o, si no tiene, el general.
export interface OwnStockProduct {
  productId: number
  name: string
  image: string | null
  units: number
  price: string
  stockLevel: StockLevel
}

// Aviso de baja existencia del propio vendedor (HU-18): un producto suyo con pocas piezas o que se
// le acabó vendiendo. Puede ser un producto con `units` 0 que no está en `products`.
export interface OwnStockAlert {
  productId: number
  name: string
  units: number
  stockLevel: 'low' | 'out'
}

export interface OwnStock {
  total: number
  products: OwnStockProduct[]
  alerts: OwnStockAlert[]
}

// Stock de un vendedor para «Mi stock»: productos con piezas (qty > 0, también archivados y bolsitas),
// por nombre. Con `includeSoldOut` (catálogo «Vender», HU-15) suma los que tuvo y se le acabaron, con
// `units` 0; el total no cambia porque suman 0. Arma cada producto con llaves explícitas y no reenvía
// la fila de stockOfHolder, para que ningún costo, costo con envío ni el precio general (cuando hay
// propio) llegue al vendedor.
export async function getOwnStock(
  profileId: string,
  options: { includeSoldOut?: boolean } = {},
): Promise<OwnStock> {
  const [lines, lowLines] = await Promise.all([stockOfHolder(profileId, options), lowStockLines(profileId)])
  const products = lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    image: line.image,
    units: line.units,
    price: line.unitPrice ?? line.price,
    stockLevel: line.stockLevel,
  }))
  const alerts = lowLines.map((line) => ({
    productId: line.productId,
    name: line.name,
    units: line.units,
    stockLevel: line.stockLevel,
  }))
  return { total: products.reduce((sum, product) => sum + product.units, 0), products, alerts }
}
