import { listSellers } from '@accounts'
import { holdingsByProduct, lowStockLines, stockLevelOf, type StockLevel } from '@stock'

// Piezas de un vendedor activo, con su nombre, para la leyenda de la barra dividida.
export interface StockSellerTotal {
  id: string
  fullName: string
  units: number
}

// Un producto con piezas en algún lugar: bodega, vendedores activos con piezas de ese producto y la
// suma de los vendedores desactivados (sin nombre). total = warehouse + Σ sellers + inactiveSellers.
export interface StockProduct {
  productId: number
  name: string
  image: string | null
  warehouse: number
  warehouseLevel: StockLevel
  sellers: { sellerId: string; units: number; stockLevel: StockLevel }[]
  inactiveSellers: number
  total: number
}

// Stock general (HU-13): todo el inventario del negocio en una sola lectura, para que los totales
// cuadren y cambiar de vendedor en «Viendo» no pida datos de nuevo.
export interface StockOverview {
  warehouse: number
  sellers: StockSellerTotal[]
  inactiveSellers: number
  total: number
  products: StockProduct[]
  lowStock: LowStockAlert[]
}

// Un aviso de baja o nula existencia (HU-18). `holder` null = bodega; solo vendedores activos.
export interface LowStockAlert {
  productId: number
  name: string
  image: string | null
  holder: { id: string; fullName: string } | null
  units: number
  stockLevel: 'low' | 'out'
}

// Junta las piezas por producto (`stock`) con los vendedores activos (`accounts`). Un titular que no
// está en la lista de activos es un vendedor desactivado: sus piezas suman al total pero se agrupan
// en `inactiveSellers`, sin exponer su nombre. Solo lee: el inventario cambia con movimientos (T-07).
export async function getStockOverview(): Promise<StockOverview> {
  const [activeSellers, holdings, lowLines] = await Promise.all([listSellers(), holdingsByProduct(), lowStockLines()])
  const activeIds = new Set(activeSellers.map((seller) => seller.id))
  const sellerUnits = new Map<string, number>(activeSellers.map((seller) => [seller.id, 0]))

  let warehouse = 0
  let inactiveSellers = 0
  const products: StockProduct[] = holdings.map((holding) => {
    const sellers: StockProduct['sellers'] = []
    let inactive = 0
    for (const holder of holding.holders) {
      if (activeIds.has(holder.profileId)) {
        sellers.push({ sellerId: holder.profileId, units: holder.units, stockLevel: stockLevelOf(holder.units) })
        sellerUnits.set(holder.profileId, (sellerUnits.get(holder.profileId) ?? 0) + holder.units)
      } else {
        inactive += holder.units
      }
    }
    warehouse += holding.warehouse
    inactiveSellers += inactive
    const total = holding.warehouse + sellers.reduce((sum, seller) => sum + seller.units, 0) + inactive
    return {
      productId: holding.productId,
      name: holding.name,
      image: holding.image,
      warehouse: holding.warehouse,
      warehouseLevel: stockLevelOf(holding.warehouse),
      sellers,
      inactiveSellers: inactive,
      total,
    }
  })

  // listSellers ya viene por nombre; las piezas se recalculan desde los productos para que el total
  // de arriba sea exactamente la suma de las filas.
  const sellers = activeSellers.map(({ id, fullName }) => ({ id, fullName, units: sellerUnits.get(id) ?? 0 }))
  const total = products.reduce((sum, product) => sum + product.total, 0)
  // lowStockLines ya excluye a los desactivados; el nombre sale de los vendedores activos.
  const names = new Map(activeSellers.map((seller) => [seller.id, seller.fullName]))
  const lowStock = lowLines.flatMap((line): LowStockAlert[] => {
    const { holderProfileId, ...rest } = line
    if (holderProfileId === null) return [{ ...rest, holder: null }]
    const fullName = names.get(holderProfileId)
    return fullName === undefined ? [] : [{ ...rest, holder: { id: holderProfileId, fullName } }]
  })
  return { warehouse, sellers, inactiveSellers, total, products, lowStock }
}
