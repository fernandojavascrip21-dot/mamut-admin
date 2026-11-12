import { requireRole } from '@auth'
import { validation } from '@lib/errors'
import { handle, parseRouteId, readJson, requireMoney, requireString } from '@lib/handler'
import { createProductFromLine, INVALID_CATEGORY_ID } from '@receipts'

type Ctx = { params: Promise<{ id: string }> }

// Da de alta el producto de un renglón pendiente (HU-42): 201 con el producto, su renglón y el stock.
// `unitCost` es opcional: si no viene, se usa el costo leído de la remisión.
export const POST = handle<Ctx>(async (request, { params }) => {
  const actor = await requireRole(request, 'admin')
  const lineId = parseRouteId((await params).id)
  const body = await readJson(request)

  const categoryIdRaw = body['categoryId']
  let categoryId: number | null = null
  if (categoryIdRaw !== null && categoryIdRaw !== undefined) {
    if (typeof categoryIdRaw !== 'number' || !Number.isInteger(categoryIdRaw)) {
      throw validation(INVALID_CATEGORY_ID)
    }
    categoryId = categoryIdRaw
  }

  const unitCostRaw = body['unitCost']
  const result = await createProductFromLine(lineId, {
    name: requireString(body, 'name').trim(),
    price: requireMoney(body, 'price', { scale: 2, label: 'El precio' }),
    categoryId,
    unitCost: unitCostRaw === undefined || unitCostRaw === null
      ? undefined
      : requireMoney(body, 'unitCost', { scale: 4, label: 'El costo' }),
  }, actor)
  return Response.json(result, { status: 201 })
})
