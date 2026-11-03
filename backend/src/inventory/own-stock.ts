import { stockOfHolder } from '@stock'

// Un producto del stock propio del vendedor (HU-14): solo lo que él puede ver (RNF-04).
// `price` ya viene resuelto: el precio propio (vendor_stock.unit_price) o, si no tiene, el general.
export interface OwnStockProduct {
  productId: number
  name: string
  image: string | null
  units: number
  price: string
}

export interface OwnStock {
  total: number
  products: OwnStockProduct[]
}

// Stock de un vendedor para «Mi stock»: productos con piezas (qty > 0, también archivados y bolsitas),
// por nombre. Arma cada producto con llaves explícitas y no reenvía la fila de stockOfHolder, para que
// ningún costo, costo con envío ni el precio general (cuando hay propio) llegue al vendedor.
export async function getOwnStock(profileId: string): Promise<OwnStock> {
  const lines = await stockOfHolder(profileId)
  const products = lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    image: line.image,
    units: line.units,
    price: line.unitPrice ?? line.price,
  }))
  return { total: products.reduce((sum, product) => sum + product.units, 0), products }
}
