import { z } from 'zod'
import { compareLanguageVersions, LANGUAGES } from '../src/lib/languages.ts'

const packageSchema = z.object({
  installed: z.boolean(),
  language: z.string(),
  language_version: z.string()
})

const installedPackageSchema = z.object({
  language: z.string(),
  version: z.string()
})

const PISTON_URL = Bun.env.PISTON_URL ?? 'http://localhost:2000'

const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 3000

/** The engine fetches its package index from GitHub on every lookup, and that fetch stalls now and then. */
const withRetry = <T>(work: () => Promise<T>, attempts: number): Promise<T> =>
  work().catch(async (error: unknown) => {
    if (attempts <= 1) {
      throw error
    }

    console.warn(`… retrying after: ${error instanceof Error ? error.message : String(error)}`)
    await Bun.sleep(RETRY_DELAY_MS)

    return withRetry(work, attempts - 1)
  })

const callOnce = async (path: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(`${PISTON_URL}${path}`, init)
  const body = await response.text()

  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed (${response.status}): ${body}`)
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`${path} returned invalid JSON: ${body.slice(0, 200)}`)
  }
}

const call = (path: string, init?: RequestInit): Promise<unknown> =>
  withRetry(() => callOnce(path, init), RETRY_ATTEMPTS)

type PistonPackage = z.infer<typeof packageSchema>

const newest = (candidates: PistonPackage[]): PistonPackage =>
  candidates.reduce((best, entry) =>
    compareLanguageVersions(entry.language_version, best.language_version) > 0 ? entry : best
  )

const installPackage = async (name: string, packages: PistonPackage[]): Promise<void> => {
  const candidates = packages.filter((entry) => entry.language === name)
  if (candidates.length === 0) {
    throw new Error(`Piston has no package named "${name}"`)
  }

  const chosen = newest(candidates)
  if (chosen.installed) {
    console.log(`✓ ${name} ${chosen.language_version} is already installed`)
    return
  }

  const installed = installedPackageSchema.parse(
    await call('/api/v2/packages', {
      body: JSON.stringify({ language: name, version: chosen.language_version }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
  )

  console.log(`✓ installed ${installed.language} ${installed.version}`)
}

const main = async (): Promise<void> => {
  const packages = z.array(packageSchema).parse(await call('/api/v2/packages'))

  const wanted = new Set(LANGUAGES.map((language) => language.package))
  // `node` first: the typescript package's tsc is a node program.
  const ordered = ['node', ...[...wanted].filter((name) => name !== 'node')]

  for (const name of ordered) {
    // Installs run one at a time so a failed install stops the run instead of being logged past.
    // oxlint-disable-next-line no-await-in-loop
    await installPackage(name, packages)
  }

  const runtimes = z.array(installedPackageSchema).parse(await call('/api/v2/runtimes'))
  console.log('\nInstalled runtimes:')
  for (const runtime of runtimes) {
    console.log(`  ${runtime.language} ${runtime.version}`)
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
