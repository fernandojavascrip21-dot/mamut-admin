import { asc } from 'drizzle-orm'
import { db } from '@db/client'
import { categories } from '@db/schema'

export function listCategories() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
}
