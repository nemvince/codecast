import { SmartCoercionPlugin } from '@orpc/json-schema'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { onError } from '@orpc/server'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { createFileRoute } from '@tanstack/react-router'
import { env } from '@/lib/env'
import router from '@/orpc/router'

/** The cookie Better Auth sets. `__Secure-` appears in front of it when BASE_URL is https. */
const SESSION_COOKIE = 'better-auth.session_token'

/**
 * The same router the app talks to over /api/rpc, served as a documented REST API for scripts. Every
 * procedure keeps the guard it has in the app: nothing here is reachable that the app could not
 * reach. Authentication is the Better Auth session cookie, and the sign-in endpoints themselves are
 * documented by the auth server at /api/auth/reference.
 */
const handler = new OpenAPIHandler(router, {
  interceptors: [
    onError((error) => {
      console.error(error)
    })
  ],
  plugins: [
    new SmartCoercionPlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()]
    }),
    new OpenAPIReferencePlugin({
      docsTitle: 'CodeCast API',
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        components: {
          securitySchemes: {
            sessionCookie: {
              description: `Set by the GitHub sign-in at /api/auth/sign-in/social, and prefixed with __Secure- when BASE_URL is https.`,
              in: 'cookie',
              name: SESSION_COOKIE,
              type: 'apiKey'
            }
          }
        },
        info: {
          description: `Start a cast, edit it as its owner, or watch and run code against a live one. The auth endpoints are documented at /api/auth/reference.`,
          title: 'CodeCast API',
          version: '1.0.0'
        },
        servers: [{ description: 'This deployment', url: env.BASE_URL }]
      }
    })
  ]
})

const handle = async ({ request }: { request: Request }) => {
  const { response } = await handler.handle(request, {
    context: { headers: request.headers },
    prefix: '/api'
  })

  return response ?? new Response('Not Found', { status: 404 })
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      DELETE: handle,
      GET: handle,
      HEAD: handle,
      PATCH: handle,
      POST: handle,
      PUT: handle
    }
  }
})
