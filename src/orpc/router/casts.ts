import type { RateLimiter } from '@orpc/ratelimit'
import { ORPCError, eventIterator, os } from '@orpc/server'
import { desc, eq, lt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { runs, casts } from '@/db/schema'
import { auth } from '@/lib/auth/server'
import { castEvents, publishCastEvent } from '@/lib/cast/bus'
import {
  MAX_RUNS_PER_SESSION,
  randomId,
  SESSION_TTL_MS,
  SLUG_LENGTH,
  slugSchema
} from '@/lib/cast/slug'
import { findLanguage, type LanguageDefinition } from '@/lib/languages'
import { clientKey, createCastLimiter, openFeed, runLimiter } from '@/lib/limits'
import { execute as runOnPiston, fetchAvailableLanguages, PistonError } from '@/lib/piston'
import {
  CastEventSchema,
  CastStateSchema,
  MyCastSchema,
  type Run,
  type RunResult,
  RunResultSchema,
  RunSchema
} from '@/orpc/schema'

const CODE_LIMIT = 100_000
const MY_CASTS_LIMIT = 20
const STDIN_LIMIT = 10_000

/** Better Auth needs the request headers to resolve the caller's session. */
const base = os.$context<{ headers: Headers }>()

/**
 * The limiter middleware from the rate limit docs, mounted against this app's oRPC: the helper's own
 * middleware and header plugin are written for oRPC 1.14 handler internals, which 1.15 reshaped. It
 * takes the `RateLimiter` the docs describe instead, so only the wiring is local and the counter —
 * fixed window, weight, result shape — is the helper's.
 *
 * One rule per request kind: the limiter differs, the key is always the same client. Runs and cast
 * creation are the whole of it — reads cost one indexed query, and the page refetches them on every
 * event, so metering those would throttle a viewer watching a fast typist.
 *
 * ponytail: hand-written middleware; swap for the helper's `ratelimit()` when the app is on oRPC 2.
 */
const limitByClient = (prefix: string, limiter: RateLimiter) =>
  base.middleware(async ({ context, next }) => {
    const result = await limiter.limit(`${prefix}:${clientKey(context.headers)}`)
    if (!result.success) {
      throw new ORPCError('TOO_MANY_REQUESTS', {
        data: { limit: result.limit, remaining: result.remaining, reset: result.reset },
        message: 'Too many requests in a row. Try again in a moment.'
      })
    }

    return next()
  })

const limitRuns = limitByClient('runs', runLimiter)
const limitCastCreation = limitByClient('create', createCastLimiter)

/** Better Auth resolves the caller from the request headers; every session rule starts here. */
const sessionFrom = async (headers: Headers) => {
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Sign in to continue.' })
  }

  return session
}

const requireSession = base.middleware(async ({ context, next }) =>
  next({ context: { session: await sessionFrom(context.headers) } })
)

const requireLanguage = (id: string): LanguageDefinition => {
  const definition = findLanguage(id)
  if (!definition) {
    throw new ORPCError('INTERNAL_SERVER_ERROR', { message: `Unknown language: ${id}` })
  }

  return definition
}

const isLive = (expiresAt: Date): boolean => expiresAt.getTime() > Date.now()

/** The row behind a slug: nothing in this router reads a cast without going through it. */
const findCast = async (slug: string) => {
  const [cast] = await db.select().from(casts).where(eq(casts.slug, slug))
  if (!cast) {
    throw new ORPCError('NOT_FOUND', { message: 'This cast has ended.' })
  }

  return cast
}

/** Anyone with the link may run their own code, but only against a cast that is still live. */
const requireLiveCast = base.middleware(async ({ next }, input: { slug: string }) => {
  const cast = await findCast(input.slug)
  if (!isLive(cast.expiresAt)) {
    throw new ORPCError('NOT_FOUND', { message: 'This cast has ended.' })
  }

  return next({ context: { cast } })
})

/**
 * A live feed is held open for as long as the viewer stays, so it is the one request whose cost
 * outlives its response. Reserving the slot in a middleware rather than in the handler is what makes
 * a refusal an honest 429: once the stream has started, an error can only break it.
 */
const requireFeedSlot = base.middleware(async ({ context, next, signal }) => {
  const release = openFeed(clientKey(context.headers))
  if (!release) {
    throw new ORPCError('TOO_MANY_REQUESTS', {
      message: 'Too many live casts open from here. Close one and reload.'
    })
  }

  // Also freed by the handler, whichever comes first: a slot that leaks locks a client out for good.
  signal?.addEventListener('abort', release)

  return next({ context: { releaseFeed: release } })
})

/** Ownership is one rule with one answer, so every owner guard asks the same question. */
const requireOwnership = async (headers: Headers, slug: string) => {
  const session = await sessionFrom(headers)
  const cast = await findCast(slug)
  if (cast.userId !== session.user.id) {
    throw new ORPCError('FORBIDDEN', { message: 'This cast belongs to another account.' })
  }

  return cast
}

/** Editing follows the account that started the cast: there is no shareable edit credential. */
const requireLiveOwner = base.middleware(async ({ context, next }, input: { slug: string }) => {
  const cast = await requireOwnership(context.headers, input.slug)
  if (!isLive(cast.expiresAt)) {
    throw new ORPCError('NOT_FOUND', { message: 'This cast has ended.' })
  }

  return next({ context: { cast } })
})

/** Owning a cast is enough to delete it, but only once it is over: a live one must be stopped. */
const requireStoppedOwner = base.middleware(async ({ context, next }, input: { slug: string }) => {
  const cast = await requireOwnership(context.headers, input.slug)
  if (isLive(cast.expiresAt)) {
    throw new ORPCError('BAD_REQUEST', { message: 'Stop the cast before deleting it.' })
  }

  return next({ context: { cast } })
})

const requireAvailableLanguage = async (id: string, version: string): Promise<void> => {
  const available = await withEngine(() => fetchAvailableLanguages())
  if (!available.some((language) => language.id === id && language.version === version)) {
    throw new ORPCError('BAD_REQUEST', { message: 'That language is not available.' })
  }
}

/** Piston being down is an upstream failure, not a bug in the request. */
const withEngine = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work()
  } catch (error) {
    if (error instanceof PistonError) {
      throw new ORPCError('BAD_GATEWAY', {
        message: 'The code execution engine is unreachable.'
      })
    }
    throw error
  }
}

const executeAndShape = async (input: {
  language: string
  version: string
  code: string
  stdin: string
}): Promise<RunResult> => {
  const language = requireLanguage(input.language)
  const { durationMs, result } = await withEngine(() =>
    runOnPiston({
      code: input.code,
      file: language.file,
      language: input.language,
      stdin: input.stdin,
      version: input.version
    })
  )

  return {
    compile: result.compile
      ? {
          exitCode: result.compile.code,
          signal: result.compile.signal,
          stderr: result.compile.stderr,
          stdout: result.compile.stdout
        }
      : null,
    durationMs,
    stage: {
      exitCode: result.run.code,
      signal: result.run.signal,
      stderr: result.run.stderr,
      stdout: result.run.stdout
    },
    stdin: input.stdin
  }
}

const toRun = (row: typeof runs.$inferSelect): Run => ({
  compile:
    row.compileExitCode === null && row.compileSignal === null
      ? null
      : {
          exitCode: row.compileExitCode,
          signal: row.compileSignal,
          stderr: row.compileStderr,
          stdout: row.compileStdout
        },
  createdAt: row.createdAt.toISOString(),
  durationMs: row.durationMs,
  id: row.id,
  stage: {
    exitCode: row.exitCode,
    signal: row.signal,
    stderr: row.stderr,
    stdout: row.stdout
  },
  stdin: row.stdin
})

export const listLanguages = base
  .input(z.object({}))
  .handler(() => withEngine(() => fetchAvailableLanguages()))

export const createCast = base
  .input(z.object({}))
  .use(limitCastCreation)
  .use(requireSession)
  .handler(async ({ context }) => {
    const [first] = await withEngine(() => fetchAvailableLanguages())
    if (!first) {
      throw new ORPCError('SERVICE_UNAVAILABLE', {
        message: 'No code runtimes are installed in Piston. Run: bun run piston:setup'
      })
    }

    await db.delete(casts).where(lt(casts.expiresAt, sql`now() - interval '7 days'`))

    const [created] = await db
      .insert(casts)
      .values({
        code: requireLanguage(first.id).starter,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        language: first.id,
        slug: randomId(SLUG_LENGTH),
        stdin: '',
        userId: context.session.user.id,
        version: first.version
      })
      .returning({ slug: casts.slug })

    return created
  })

/** Deletes the run history with the cast: `runs.cast_id` cascades, and watchers are told to stop. */
export const deleteCast = base
  .input(z.object({ slug: slugSchema }))
  .use(requireStoppedOwner)
  .handler(async ({ context, input }) => {
    await db.delete(casts).where(eq(casts.id, context.cast.id))
    publishCastEvent(input.slug, 'cast')

    return { ok: true }
  })

export const listMyCasts = base
  .use(requireSession)
  .input(z.object({}))
  .output(z.array(MyCastSchema))
  .handler(async ({ context }) => {
    const rows = await db
      .select({ createdAt: casts.createdAt, expiresAt: casts.expiresAt, slug: casts.slug })
      .from(casts)
      .where(eq(casts.userId, context.session.user.id))
      .orderBy(desc(casts.createdAt))
      .limit(MY_CASTS_LIMIT)

    return rows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      slug: row.slug,
      status: isLive(row.expiresAt) ? ('active' as const) : ('ended' as const)
    }))
  })

export const getCast = base
  .input(z.object({ slug: slugSchema }))
  .output(CastStateSchema)
  .handler(async ({ context, input }) => {
    const [cast] = await db.select().from(casts).where(eq(casts.slug, input.slug))
    if (!cast) {
      return { status: 'missing' as const }
    }
    if (!isLive(cast.expiresAt)) {
      return { endedAt: cast.expiresAt.toISOString(), status: 'ended' as const }
    }

    const [latest] = await db
      .select({ id: runs.id })
      .from(runs)
      .where(eq(runs.castId, cast.id))
      .orderBy(desc(runs.createdAt))
      .limit(1)

    // Watching is public, so the caller is resolved only to decide who gets the editor.
    const session = await auth.api.getSession({ headers: context.headers })

    return {
      cast: {
        code: cast.code,
        expiresAt: cast.expiresAt.toISOString(),
        isOwner: session?.user.id === cast.userId,
        language: cast.language,
        latestRunId: latest?.id ?? null,
        slug: cast.slug,
        stdin: cast.stdin,
        version: cast.version
      },
      status: 'active' as const
    }
  })

export const listRuns = base
  .input(z.object({ slug: slugSchema }))
  .output(z.array(RunSchema))
  .handler(async ({ input }) => {
    const [cast] = await db.select({ id: casts.id }).from(casts).where(eq(casts.slug, input.slug))

    if (!cast) {
      return []
    }

    const rows = await db
      .select()
      .from(runs)
      .where(eq(runs.castId, cast.id))
      .orderBy(desc(runs.createdAt))
      .limit(MAX_RUNS_PER_SESSION)

    return rows.map((row) => toRun(row))
  })

/**
 * Read-only change feed for one session: viewers follow the instructor's typing instead of polling.
 * Frames carry no session data, only the fact that something changed and what to refetch. The
 * stream only ends when the viewer goes away, so a dropped connection is reconnected by the client,
 * which then refetches both keys rather than asking the server to replay what it missed.
 */
export const watchCast = base
  .input(z.object({ slug: slugSchema }))
  .output(eventIterator(CastEventSchema))
  .use(requireLiveCast)
  .use(requireFeedSlot)
  .handler(async function* feed({ context, input, signal }) {
    try {
      for await (const event of castEvents.subscribe(input.slug, { signal })) {
        yield event
      }
    } finally {
      context.releaseFeed()
    }
  })

export const updateCast = base
  .input(
    z.object({
      code: z.string().max(CODE_LIMIT).optional(),
      language: z.string().optional(),
      slug: slugSchema,
      stdin: z.string().max(STDIN_LIMIT).optional(),
      version: z.string().optional()
    })
  )
  .use(requireLiveOwner)
  .handler(async ({ context, input }) => {
    if ((input.language === undefined) !== (input.version === undefined)) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'A language change needs both a language and a version.'
      })
    }
    if (input.language !== undefined && input.version !== undefined) {
      await requireAvailableLanguage(input.language, input.version)
    }

    const changes = {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.stdin === undefined ? {} : { stdin: input.stdin }),
      ...(input.version === undefined ? {} : { version: input.version })
    }

    if (Object.keys(changes).length > 0) {
      await db.update(casts).set(changes).where(eq(casts.id, context.cast.id))
      publishCastEvent(input.slug, 'cast')
    }

    return { ok: true }
  })

export const runCastCode = base
  .input(
    z.object({
      code: z.string().max(CODE_LIMIT),
      slug: slugSchema,
      stdin: z.string().max(STDIN_LIMIT)
    })
  )
  .use(limitRuns)
  .use(requireLiveOwner)
  .output(RunSchema)
  .handler(async ({ context, input }) => {
    // Persist the submitted code first: a run must never drift from the code it ran.
    await db
      .update(casts)
      .set({ code: input.code, stdin: input.stdin })
      .where(eq(casts.id, context.cast.id))

    const result = await executeAndShape({
      code: input.code,
      language: context.cast.language,
      stdin: input.stdin,
      version: context.cast.version
    })

    const [inserted] = await db
      .insert(runs)
      .values({
        castId: context.cast.id,
        compileExitCode: result.compile?.exitCode ?? null,
        compileSignal: result.compile?.signal ?? null,
        compileStderr: result.compile?.stderr ?? '',
        compileStdout: result.compile?.stdout ?? '',
        durationMs: result.durationMs,
        exitCode: result.stage.exitCode,
        language: context.cast.language,
        signal: result.stage.signal,
        stderr: result.stage.stderr,
        stdin: input.stdin,
        stdout: result.stage.stdout,
        version: context.cast.version
      })
      .returning()

    await db.execute(
      sql`DELETE FROM runs WHERE cast_id = ${context.cast.id} AND id NOT IN (SELECT id FROM runs WHERE cast_id = ${context.cast.id} ORDER BY created_at DESC LIMIT ${MAX_RUNS_PER_SESSION})`
    )

    publishCastEvent(input.slug, 'cast')
    publishCastEvent(input.slug, 'runs')

    return toRun(inserted)
  })

export const runScratchCode = base
  .input(
    z.object({
      code: z.string().max(CODE_LIMIT),
      language: z.string(),
      slug: slugSchema,
      stdin: z.string().max(STDIN_LIMIT),
      version: z.string()
    })
  )
  .use(limitRuns)
  .use(requireLiveCast)
  .output(RunResultSchema)
  .handler(async ({ input }) => {
    await requireAvailableLanguage(input.language, input.version)

    return executeAndShape(input)
  })

export const endCast = base
  .input(z.object({ slug: slugSchema }))
  .use(requireLiveOwner)
  .handler(async ({ context, input }) => {
    await db.update(casts).set({ expiresAt: new Date() }).where(eq(casts.id, context.cast.id))
    publishCastEvent(input.slug, 'cast')

    return { ok: true }
  })
