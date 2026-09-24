import { z } from 'zod'
import { env } from '@/lib/env'
import { compareLanguageVersions, LANGUAGES } from '@/lib/languages'

export interface PistonRuntime {
  language: string
  version: string
  aliases: string[]
  runtime?: string
}

export interface PistonStage {
  stdout: string
  stderr: string
  code: number | null
  signal: string | null
}

export interface PistonExecuteResult {
  language: string
  version: string
  run: PistonStage
  compile?: PistonStage
}

export interface AvailableLanguage {
  id: string
  label: string
  version: string
}

export class PistonError extends Error {
  override name = 'PistonError'
}

const stageSchema = z.object({
  code: z.number().nullable(),
  signal: z.string().nullable(),
  stderr: z.string(),
  stdout: z.string()
})

const executeResultSchema = z.object({
  compile: stageSchema.optional(),
  language: z.string(),
  run: stageSchema,
  version: z.string()
})

const runtimeSchema = z.object({
  aliases: z.array(z.string()),
  language: z.string(),
  runtime: z.string().optional(),
  version: z.string()
})

const RUNTIMES_TTL_MS = 30_000

let runtimeCache: { at: number; runtimes: PistonRuntime[] } | null = null

const callPiston = async (path: string, init: RequestInit): Promise<unknown> => {
  const response = await fetch(`${env.PISTON_URL}${path}`, init).catch((error: unknown) => {
    throw new PistonError(`The code execution engine is unreachable: ${String(error)}`)
  })

  const body = await response.text()
  if (!response.ok) {
    throw new PistonError(`The code execution engine responded ${response.status}: ${body}`)
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new PistonError(`The code execution engine returned invalid JSON: ${body.slice(0, 200)}`)
  }
}

const fetchRuntimes = async (): Promise<PistonRuntime[]> => {
  if (runtimeCache && performance.now() - runtimeCache.at < RUNTIMES_TTL_MS) {
    return runtimeCache.runtimes
  }

  const parsed = z.array(runtimeSchema).safeParse(await callPiston('/api/v2/runtimes', {}))
  if (!parsed.success) {
    throw new PistonError(`Unexpected runtime list: ${parsed.error.message}`)
  }

  runtimeCache = { at: performance.now(), runtimes: parsed.data }

  return parsed.data
}

/** Piston lists one entry per version, so keep the newest per language. */
const highestVersionByLanguage = (runtimes: PistonRuntime[]): Map<string, string> => {
  const highest = new Map<string, string>()

  for (const runtime of runtimes) {
    const current = highest.get(runtime.language)
    if (current === undefined || compareLanguageVersions(runtime.version, current) > 0) {
      highest.set(runtime.language, runtime.version)
    }
  }

  return highest
}

/** Only the languages the app offers, and only the ones actually installed in this engine. */
export const fetchAvailableLanguages = async (): Promise<AvailableLanguage[]> => {
  const highest = highestVersionByLanguage(await fetchRuntimes())
  const available: AvailableLanguage[] = []

  for (const language of LANGUAGES) {
    const version = highest.get(language.id)
    if (version !== undefined) {
      available.push({ id: language.id, label: language.label, version })
    }
  }

  return available
}

export const execute = async (request: {
  language: string
  version: string
  file: string
  code: string
  stdin: string
}): Promise<{ result: PistonExecuteResult; durationMs: number }> => {
  const startedAt = performance.now()
  const body = await callPiston('/api/v2/execute', {
    body: JSON.stringify({
      files: [{ content: request.code, name: request.file }],
      language: request.language,
      stdin: request.stdin,
      version: request.version
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  })

  const parsed = executeResultSchema.safeParse(body)
  if (!parsed.success) {
    throw new PistonError(`Unexpected execution result: ${parsed.error.message}`)
  }

  // Whole milliseconds: the run row and the wire schema both carry this as an integer.
  return { durationMs: Math.round(performance.now() - startedAt), result: parsed.data }
}
