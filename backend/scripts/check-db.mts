import { count } from 'drizzle-orm'
import { db, sql } from '../src/db/client'
import { categories } from '../src/db/schema'

const [row] = await db.select({ total: count() }).from(categories)
console.log('categories:', row?.total)
await sql.end()
