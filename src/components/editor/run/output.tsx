import type { RunResult } from '@/orpc/schema'

export interface RunStatus {
  label: string
  tone: RunTone
  hint?: string
}

export type RunTone = 'error' | 'ok' | 'warn'

export const runStatus = (run: RunResult): RunStatus => {
  if (run.compile && (run.compile.exitCode !== 0 || run.compile.signal !== null)) {
    return { label: 'Compile error', tone: 'error' }
  }
  if (run.stage.signal !== null) {
    return {
      hint:
        run.stage.signal === 'SIGKILL'
          ? 'the run was killed — usually the 5 s time limit'
          : undefined,
      label: `Stopped (${run.stage.signal})`,
      tone: 'error'
    }
  }
  if (run.stage.exitCode === null) {
    return { label: 'Stopped', tone: 'error' }
  }
  if (run.stage.exitCode !== 0) {
    return { label: `Exit code ${run.stage.exitCode}`, tone: 'warn' }
  }

  return { label: 'Exit code 0', tone: 'ok' }
}

interface OutputSection {
  title: string
  text: string
}

/** Only the parts a reader needs: empty sections carry no information. */
const outputSections = (run: RunResult): OutputSection[] => {
  const compilerOutput = run.compile ? `${run.compile.stdout}${run.compile.stderr}` : ''
  const offered: OutputSection[] = [
    { text: compilerOutput, title: 'Compiler output' },
    { text: run.stage.stdout, title: 'stdout' },
    { text: run.stage.stderr, title: 'stderr' },
    { text: run.stdin, title: 'Input' }
  ]

  return offered.filter((section) => section.text.trim().length > 0)
}

interface RunOutputProps {
  run: RunResult
}

export const RunOutput = ({ run }: RunOutputProps) => {
  const sections = outputSections(run)

  return (
    <article className='flex min-w-0 flex-1 flex-col'>
      {sections.length === 0 ? (
        <div className='flex grow items-center justify-center'>
          <p className='text-muted-foreground m-0 text-xs'>(no output)</p>
        </div>
      ) : (
        sections.map((section) => (
          <section
            className='bg-muted/40 flex flex-col overflow-y-auto border-t'
            key={section.title}
          >
            <p className='text-muted-foreground border-b p-2 text-xs font-medium'>
              {section.title}
            </p>
            <pre className='m-2 max-h-64 overflow-y-auto font-mono text-xs whitespace-pre-wrap'>
              {section.text}
            </pre>
          </section>
        ))
      )}
    </article>
  )
}
