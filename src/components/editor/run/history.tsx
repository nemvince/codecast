import { HourglassIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import type { Run } from '@/orpc/schema'
import { RunOutput, runStatus, type RunTone } from '@/components/editor/run/output'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { formatClock, formatDuration } from '@/lib/format'

const TONE_DOT: Record<RunTone, string> = {
  error: 'bg-destructive',
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500'
}

interface RunHistoryProps {
  runs: Run[]
  /** Viewers cannot run the cast code, so the default hint would point at a button they lack. */
  emptyHint?: string
}

/**
 * A run list beside the output it opens, rather than one long accordion: the newest run is
 * selected as it lands, and picking an older one only changes which output is on screen.
 */
export const RunHistory = ({
  emptyHint = 'Press Run to execute the code.',
  runs
}: RunHistoryProps) => {
  const [selectedId, setSelectedId] = useState(runs[0]?.id)

  useEffect(() => {
    setSelectedId(runs[0]?.id)
  }, [runs[0]?.id])

  if (runs.length === 0) {
    return (
      <Empty className='grow'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HourglassIcon />
          </EmptyMedia>
          <EmptyTitle>No runs yet</EmptyTitle>
          <EmptyDescription>{emptyHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const selected = runs.find((run) => run.id === selectedId) ?? runs[0]

  return (
    <div className='flex h-full'>
      <RunOutput run={selected} />

      <ol className='m-0 flex w-28 shrink-0 list-none flex-col gap-0.5 overflow-auto border-l pl-2 sm:w-40'>
        {runs.map((run) => {
          const isSelected = run.id === selected.id

          return (
            <li key={run.id}>
              <button
                aria-current={isSelected}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
                onClick={() => setSelectedId(run.id)}
                title={`#${run.id} · ${formatClock(run.createdAt)}`}
                type='button'
              >
                <span
                  aria-hidden='true'
                  className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[runStatus(run).tone]}`}
                />
                <span className='font-mono font-medium'>#{run.id}</span>
                <span className='ml-auto tabular-nums'>{formatDuration(run.durationMs)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
