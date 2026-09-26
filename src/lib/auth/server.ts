import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, openAPI } from 'better-auth/plugins'
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
  /**
   * `admin` for bans and roles, `openAPI` for the reference at /api/auth/reference: the sign-in,
   * session and admin endpoints live under /api/auth, so they belong in the documented surface
   * rather than in a second, hand-maintained list.
   */
  plugins: [admin(), openAPI()],
  secret: env.AUTH_SECRET,
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET
    }
  }
})
