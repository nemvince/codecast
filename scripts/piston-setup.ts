import { z } from 'zod'
import { LANGUAGES } from '../src/lib/languages.ts'

/**
 * The versions this app is verified against. Piston serves its package index from GitHub, so which
 * version is newest there changes without warning; installing by fixed version keeps a rebuilt
 * engine identical to the one that was tested. To move up, change a version here and re-run — the
 * app then offers the newest installed version of each language.
 */
const PINNED_VERSIONS: Record<string, string> = {
  gcc: '10.2.0',
  go: '1.16.2',
  java: '15.0.2',
  node: '20.11.1',
  python: '3.12.0',
  rust: '1.68.2',
  typescript: '5.0.3'
}

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

const installPackage = async (
  name: string,
  version: string,
  packages: PistonPackage[]
): Promise<void> => {
  const pinned = packages.find(
    (entry) => entry.language === name && entry.language_version === version
  )
  if (!pinned) {
    throw new Error(`Piston does not offer ${name} ${version}`)
  }

  if (pinned.installed) {
    console.log(`✓ ${name} ${version} is already installed`)
    return
  }

  const installed = installedPackageSchema.parse(
    await call('/api/v2/packages', {
      body: JSON.stringify({ language: name, version }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
  )

  console.log(`✓ installed ${installed.language} ${installed.version}`)
}

/** Every language the app offers needs a pinned version; `node` goes first, tsc is a node program. */
const installOrder = (): string[] => {
  const wanted = [...new Set(LANGUAGES.map((language) => language.package))]
  const unpinned = wanted.filter((name) => !PINNED_VERSIONS[name])
  if (unpinned.length > 0) {
    throw new Error(`No pinned version for: ${unpinned.join(', ')}`)
  }

  return ['node', ...wanted.filter((name) => name !== 'node')]
}

const main = async (): Promise<void> => {
  const packages = z.array(packageSchema).parse(await call('/api/v2/packages'))

  for (const name of installOrder()) {
    // Installs run one at a time so a failed install stops the run instead of being logged past.
    // oxlint-disable-next-line no-await-in-loop
    await installPackage(name, PINNED_VERSIONS[name], packages)
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
