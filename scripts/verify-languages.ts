import { findLanguage } from '../src/lib/languages.ts'
import { execute, fetchAvailableLanguages, type AvailableLanguage } from '../src/lib/piston.ts'

const checkLanguage = async (entry: AvailableLanguage) => {
  const definition = findLanguage(entry.id)
  if (!definition) {
    return { failure: `${entry.id}: no language definition`, line: '', ok: false }
  }

  const { durationMs, result } = await execute({
    code: definition.starter,
    file: definition.file,
    language: entry.id,
    stdin: '',
    version: entry.version
  })

  const failed = result.run.code !== 0 || result.run.signal !== null

  return {
    failure: failed
      ? `stderr: ${result.compile?.stderr || result.run.stderr}`
      : `exit ${result.run.code} in ${Math.round(durationMs)} ms`,
    line: result.run.stdout.split('\n')[0] ?? '',
    ok: !failed
  }
}

const available = await fetchAvailableLanguages()
console.log(`Engine offers ${available.length} languages\n`)

const results = await Promise.all(available.map((entry) => checkLanguage(entry)))

available.forEach((entry, index) => {
  const result = results[index]
  console.log(`${result.ok ? '✓' : '✗'} ${entry.id} ${entry.version} → ${result.failure}`)
  if (result.line) {
    console.log(`    ${result.line}`)
  }
})

const failures = results.filter((result) => !result.ok).length
console.log(`\n${failures === 0 ? 'ALL LANGUAGES OK' : `${failures} LANGUAGE(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
