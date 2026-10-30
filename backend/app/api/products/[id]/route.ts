import { getProduct, updateProduct } from '@products'
import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle, parseId, readJson, requireMoney, requireString } from '@lib/handler'

type Ctx = { params: Promise<{ id: string }> }

// Esta ruta exige 422 para un id mal formado; parseId se aplica después de comprobarlo.
async function productId(params: Ctx['params']): Promise<number> {
  const raw = (await params).id
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw validation('El id del producto debe ser un entero positivo')
  }
  return parseId(raw)
}

export const GET = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  return Response.json(await getProduct(await productId(params)))
})

export const PATCH = handle<Ctx>(async (request, { params }) => {
  await requireRole(request, 'admin')
  const id = await productId(params)
  const body = await readJson(request)

  const categoryIdRaw = body['categoryId']
  if (categoryIdRaw !== null && (
    typeof categoryIdRaw !== 'number' || !Number.isSafeInteger(categoryIdRaw)
  )) throw validation('El campo categoryId debe ser un número o null')

  const fractionable = body['fractionable']
  if (typeof fractionable !== 'boolean') throw validation('Falta el campo fractionable')

  const portionSizeRaw = body['portionSize']
  if (portionSizeRaw !== null && typeof portionSizeRaw !== 'string') {
    throw validation('El campo portionSize debe ser texto o null')
  }

  const image = body['image']
  if (typeof image !== 'string') throw validation('Falta el campo image')

  const product = await updateProduct(id, {
    name: requireString(body, 'name').trim(),
    categoryId: categoryIdRaw,
    price: requireMoney(body, 'price', { scale: 2, label: 'El precio' }),
    unitCost: requireMoney(body, 'unitCost', { scale: 4, label: 'El costo' }),
    fractionable,
    portionSize: portionSizeRaw?.trim() || null,
    image,
  })
  return Response.json(product)
})
