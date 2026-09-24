import { ORPCError, eventIterator, os } from '@orpc/server'
import { desc, eq, lt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { runs, casts } from '@/db/schema'
import { castEvents, publishCastEvent } from '@/lib/cast/bus'
import {
  EDIT_KEY_LENGTH,
  MAX_RUNS_PER_SESSION,
  randomId,
  SESSION_TTL_MS,
  SLUG_LENGTH,
  slugSchema
} from '@/lib/cast/slug'
import { findLanguage, type LanguageDefinition } from '@/lib/languages'
import { execute as runOnPiston, fetchAvailableLanguages, PistonError } from '@/lib/piston'
import {
  CastEventSchema,
  CastStateSchema,
  type Run,
  type RunResult,
  RunResultSchema,
  RunSchema
} from '@/orpc/schema'

const CODE_LIMIT = 100_000
const STDIN_LIMIT = 10_000

const requireLanguage = (id: string): LanguageDefinition => {
  const definition = findLanguage(id)
  if (!definition) {
    throw new ORPCError('INTERNAL_SERVER_ERROR', { message: `Unknown language: ${id}` })
  }

  return definition
}

const requireCast = async (slug: string, editKey: string) => {
  const [cast] = await db.select().from(casts).where(eq(casts.slug, slug))
  if (!cast || cast.expiresAt.getTime() <= Date.now()) {
    throw new ORPCError('NOT_FOUND', { message: 'This cast has ended.' })
  }
  if (cast.editKey !== editKey) {
    throw new ORPCError('FORBIDDEN', {
      message: 'You do not have editing access to this cast.'
    })
  }

  return cast
}

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

export const listLanguages = os
  .input(z.object({}))
  .handler(() => withEngine(() => fetchAvailableLanguages()))

export const createCast = os.input(z.object({})).handler(async () => {
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
      editKey: randomId(EDIT_KEY_LENGTH),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      language: first.id,
      slug: randomId(SLUG_LENGTH),
      stdin: '',
      version: first.version
    })
    .returning({ editKey: casts.editKey, slug: casts.slug })

  return created
})

export const getCast = os
  .input(z.object({ slug: slugSchema }))
  .output(CastStateSchema)
  .handler(async ({ input }) => {
    const [cast] = await db.select().from(casts).where(eq(casts.slug, input.slug))
    if (!cast) {
      return { status: 'missing' as const }
    }
    if (cast.expiresAt.getTime() <= Date.now()) {
      return { endedAt: cast.expiresAt.toISOString(), status: 'ended' as const }
    }

    const [latest] = await db
      .select({ id: runs.id })
      .from(runs)
      .where(eq(runs.castId, cast.id))
      .orderBy(desc(runs.createdAt))
      .limit(1)

    return {
      cast: {
        code: cast.code,
        expiresAt: cast.expiresAt.toISOString(),
        language: cast.language,
        latestRunId: latest?.id ?? null,
        slug: cast.slug,
        stdin: cast.stdin,
        version: cast.version
      },
      status: 'active' as const
    }
  })

export const listRuns = os
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
export const watchCast = os
  .input(z.object({ slug: slugSchema }))
  .output(eventIterator(CastEventSchema))
  .handler(async function* feed({ input, signal }) {
    for await (const event of castEvents.subscribe(input.slug, { signal })) {
      yield event
    }
  })

export const updateCast = os
  .input(
    z.object({
      code: z.string().max(CODE_LIMIT).optional(),
      editKey: z.string(),
      language: z.string().optional(),
      slug: slugSchema,
      stdin: z.string().max(STDIN_LIMIT).optional(),
      version: z.string().optional()
    })
  )
  .handler(async ({ input }) => {
    const cast = await requireCast(input.slug, input.editKey)

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
      await db.update(casts).set(changes).where(eq(casts.id, cast.id))
      publishCastEvent(input.slug, 'cast')
    }

    return { ok: true }
  })

export const runCastCode = os
  .input(
    z.object({
      code: z.string().max(CODE_LIMIT),
      editKey: z.string(),
      slug: slugSchema,
      stdin: z.string().max(STDIN_LIMIT)
    })
  )
  .output(RunSchema)
  .handler(async ({ input }) => {
    const cast = await requireCast(input.slug, input.editKey)

    // Persist the submitted code first: a run must never drift from the code it ran.
    await db
      .update(casts)
      .set({ code: input.code, stdin: input.stdin })
      .where(eq(casts.id, cast.id))

    const result = await executeAndShape({
      code: input.code,
      language: cast.language,
      stdin: input.stdin,
      version: cast.version
    })

    const [inserted] = await db
      .insert(runs)
      .values({
        castId: cast.id,
        compileExitCode: result.compile?.exitCode ?? null,
        compileSignal: result.compile?.signal ?? null,
        compileStderr: result.compile?.stderr ?? '',
        compileStdout: result.compile?.stdout ?? '',
        durationMs: result.durationMs,
        exitCode: result.stage.exitCode,
        language: cast.language,
        signal: result.stage.signal,
        stderr: result.stage.stderr,
        stdin: input.stdin,
        stdout: result.stage.stdout,
        version: cast.version
      })
      .returning()

    await db.execute(
      sql`DELETE FROM runs WHERE cast_id = ${cast.id} AND id NOT IN (SELECT id FROM runs WHERE cast_id = ${cast.id} ORDER BY created_at DESC LIMIT ${MAX_RUNS_PER_SESSION})`
    )

    publishCastEvent(input.slug, 'cast')
    publishCastEvent(input.slug, 'runs')

    return toRun(inserted)
  })

export const runScratchCode = os
  .input(
    z.object({
      code: z.string().max(CODE_LIMIT),
      language: z.string(),
      stdin: z.string().max(STDIN_LIMIT),
      version: z.string()
    })
  )
  .output(RunResultSchema)
  .handler(async ({ input }) => {
    await requireAvailableLanguage(input.language, input.version)

    return executeAndShape(input)
  })

export const endCast = os
  .input(z.object({ editKey: z.string(), slug: slugSchema }))
  .handler(async ({ input }) => {
    const cast = await requireCast(input.slug, input.editKey)
    await db.update(casts).set({ expiresAt: new Date() }).where(eq(casts.id, cast.id))
    publishCastEvent(input.slug, 'cast')

    return { ok: true }
  })
