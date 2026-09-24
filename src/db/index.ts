import { drizzle } from 'drizzle-orm/node-postgres'
export * as schema from '@/db/schema.ts'
import * as schema from '@/db/schema.ts'
import { env } from '@/lib/env.ts'

export const db = drizzle(env.DATABASE_URL, { schema })
