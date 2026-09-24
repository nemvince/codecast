import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db, schema } from '@/db'
import { env } from '@/lib/env'

export const auth = betterAuth({
  advanced: {
    database: {
      generateId: 'uuid'
    }
  },
  baseURL: env.BASE_URL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema
  }),
  secret: env.AUTH_SECRET,
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET
    }
  }
})
