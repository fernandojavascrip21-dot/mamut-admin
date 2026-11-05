import { getActiveSellerName } from '@accounts'
import { stockOfHolder, stockOfWarehouse, type StockLevel } from '@stock'

// Un producto que el administrador puede vender de un titular (HU-17). `units`, `price` y `unitCost`
// ya vienen resueltos para ese titular: la misma fuente para el tope, el precio y la ganancia.
export interface SaleCatalogProduct {
  productId: number
  name: string
  image: string | null
  units: number
  price: string
  unitCost: string
  stockLevel: StockLevel // HU-18: lo decide el backend, el frontend solo lo pinta
}

export interface SaleCatalog {
  holder: { id: string; fullName: string } | null // null = bodega
  products: SaleCatalogProduct[]
}

// Catálogo de venta de un titular, por nombre. Bodega (`null`): productos activos con las piezas de
// products.stock, precio general y costo de fábrica. Vendedor activo (404 si no existe o está
// inactivo): lo que tiene y lo que tuvo (qty 0), con su precio o el general y su costo con envío o el
// de fábrica; es la misma resolución que hace createSale al confirmar. Lleva costos: solo para admin.
export async function getSaleCatalog(holderId: string | null): Promise<SaleCatalog> {
  if (holderId === null) {
    return { holder: null, products: await stockOfWarehouse() }
  }
  const holder = await getActiveSellerName(holderId)
  const lines = await stockOfHolder(holderId, { includeSoldOut: true })
  return {
    holder,
    products: lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      image: line.image,
      units: line.units,
      price: line.unitPrice ?? line.price,
      unitCost: line.unitCostWithShipping ?? line.unitCost,
      stockLevel: line.stockLevel,
    })),
  }
}
