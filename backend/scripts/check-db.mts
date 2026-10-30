import { count } from 'drizzle-orm'
import { db, sql } from '@db/client'
import { categories } from '@db/schema'

const [row] = await db.select({ total: count() }).from(categories)
console.log('categories:', row?.total)
await sql.end()
