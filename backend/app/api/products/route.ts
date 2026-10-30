import { createProduct, listProducts } from '../../../src/products'
import { requireRole } from '../../../src/auth'
import { validation } from '../../../src/lib/errors'
import { handle, optionalText, readJson, requireMoney, requireNumber, requireString } from '../../../src/lib/handler'

export const GET = handle(async (request) => {
  await requireRole(request, 'admin')
  return Response.json(await listProducts())
})

export const POST = handle(async (request) => {
  const ctx = await requireRole(request, 'admin')
  const body = await readJson(request)

  const fractionableRaw = body['fractionable']
  if (typeof fractionableRaw !== 'boolean') throw validation('Falta el campo fractionable')

  const categoryIdRaw = body['categoryId']
  let categoryId: number | null = null
  if (categoryIdRaw !== null && categoryIdRaw !== undefined) {
    if (typeof categoryIdRaw !== 'number' || !Number.isInteger(categoryIdRaw)) {
      throw validation('El campo categoryId debe ser un número o null')
    }
    categoryId = categoryIdRaw
  }

  const product = await createProduct(
    {
      name: requireString(body, 'name').trim(),
      categoryId,
      price: requireMoney(body, 'price', { scale: 2, label: 'El precio' }),
      unitCost: requireMoney(body, 'unitCost', { scale: 4, label: 'El costo' }),
      initialQty: requireNumber(body, 'initialQty', { integer: true }),
      fractionable: fractionableRaw,
      portionSize: optionalText(body, 'portionSize') ?? null,
      image: optionalText(body, 'image') ?? null,
    },
    ctx.userId,
  )
  return Response.json(product, { status: 201 })
})
