import { z } from 'zod'

export const LanguageSchema = z.object({
  id: z.string(),
  label: z.string(),
  version: z.string()
})

export const RunStageSchema = z.object({
  exitCode: z.number().nullable(),
  signal: z.string().nullable(),
  stderr: z.string(),
  stdout: z.string()
})

export const RunResultSchema = z.object({
  compile: RunStageSchema.nullable(),
  durationMs: z.number(),
  stage: RunStageSchema,
  stdin: z.string()
})

export const RunSchema = RunResultSchema.extend({
  createdAt: z.string(),
  id: z.uuid()
})

/**
 * A nudge, not a payload: the client refetches through the normal query keys, so the server stays
 * the only source of truth and large run output is never pushed twice.
 */
export const CastEventSchema = z.object({
  kind: z.enum(['runs', 'cast']),
  slug: z.string()
})

export const MyCastSchema = z.object({
  createdAt: z.string(),
  expiresAt: z.string(),
  slug: z.string(),
  status: z.enum(['active', 'ended'])
})

export const CastViewSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
  isOwner: z.boolean(),
  language: z.string(),
  latestRunId: z.uuid().nullable(),
  slug: z.string(),
  stdin: z.string(),
  version: z.string()
})

export const CastStateSchema = z.discriminatedUnion('status', [
  z.object({ cast: CastViewSchema, status: z.literal('active') }),
  z.object({ endedAt: z.string(), status: z.literal('ended') }),
  z.object({ status: z.literal('missing') })
])

/** The edit key never crosses this boundary: it is the instructor's private credential. */
export type Language = z.infer<typeof LanguageSchema>
export type RunStage = z.infer<typeof RunStageSchema>
export type RunResult = z.infer<typeof RunResultSchema>
export type Run = z.infer<typeof RunSchema>
export type CastEvent = z.infer<typeof CastEventSchema>
export type CastEventKind = CastEvent['kind']
export type MyCast = z.infer<typeof MyCastSchema>
export type CastView = z.infer<typeof CastViewSchema>
export type CastState = z.infer<typeof CastStateSchema>
