import { BroadcastIcon, ClockIcon, CodeIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { RunHistory } from '@/components/editor/run/history'
import { languageIcon } from '@/components/editor/toolbar'
import { EditorWorkspace } from '@/components/editor/workspace'
import { Scratchpad } from '@/components/scratchpad'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { findLanguage } from '@/lib/languages'
import { runsQueryOptions } from '@/lib/queries'
import { orpc } from '@/orpc/client'

interface CastViewerProps {
  slug: string
}

/** In the order the switch shows them, which is also the order of a student's attention. */
const VIEWS = [
  { icon: <BroadcastIcon />, id: 'cast', label: 'Live cast' },
  { icon: <CodeIcon />, id: 'scratch', label: 'Your code' }
] as const

type View = (typeof VIEWS)[number]['id']

const isView = (value: string): value is View => VIEWS.some((view) => view.id === value)

/**
 * Both surfaces a viewer has are workspaces, so the switch between them rides in the workspace
 * toolbar instead of taking a band of its own above it.
 */
const ViewSwitch = ({ onChange, value }: { onChange: (view: View) => void; value: View }) => (
  <ToggleGroup
    aria-label='What to show'
    className='bg-muted rounded-lg p-0.75'
    onValueChange={(next) => {
      // Pressing the active side deselects it: the view only ever changes to a chosen surface.
      const [chosen] = next
      if (chosen && isView(chosen)) {
        onChange(chosen)
      }
    }}
    spacing={0}
    value={[value]}
  >
    {VIEWS.map((view) => (
      <ToggleGroupItem
        className='text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground dark:aria-pressed:bg-input/30 aria-pressed:shadow-sm'
        key={view.id}
        value={view.id}
      >
        {view.icon}
        {view.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
)

/** The viewer's counterpart to the owner's save indicator: one status the toolbar can host. */
const LiveStatus = () => (
  <Tooltip>
    <TooltipTrigger
      render={
        <span
          className='flex h-8 items-center gap-1.5 px-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-500'
          role='status'
          tabIndex={0}
        />
      }
    >
      <span
        aria-hidden='true'
        className='size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none'
      />
      Live
    </TooltipTrigger>
    <TooltipContent>Code and runs arrive here as your instructor works</TooltipContent>
  </Tooltip>
)

/** A viewer cannot switch language, so the menu is a label that still names the version. */
const CastLanguage = ({ language, version }: { language: string; version: string }) => (
  <span className='text-muted-foreground flex h-8 items-center gap-1.5 px-1.5 text-xs font-medium'>
    {languageIcon(language)}
    {findLanguage(language)?.label ?? language}
    <span className='tabular-nums'>{version}</span>
  </span>
)

export const CastViewer = ({ slug }: CastViewerProps) => {
  const castQuery = useQuery(orpc.getCast.queryOptions({ input: { slug } }))
  const state = castQuery.data
  const [view, setView] = useState<View>('cast')
  const active = state?.status === 'active' ? state.cast : null
  const runsQuery = useQuery({
    ...runsQueryOptions(slug, active?.latestRunId ?? null),
    enabled: active !== null
  })
  const runs = runsQuery.data ?? []

  if (!state) {
    return <Skeleton className='grow rounded-none' />
  }

  // With the cast over, the student's own code is the only surface left.
  // It comes up directly rather than behind a switch that has one live side.
  if (!active) {
    return (
      <div className='flex grow flex-col gap-4'>
        <Alert>
          <ClockIcon />
          <AlertTitle>This cast has ended</AlertTitle>
          <AlertDescription>
            The link is closed, so the shared code is gone. Your own code is still saved in this
            browser.
          </AlertDescription>
        </Alert>
        <Scratchpad defaultLanguage='' slug={slug} />
      </div>
    )
  }

  const viewSwitch = <ViewSwitch onChange={setView} value={view} />

  return (
    <div className='flex grow flex-col'>
      {view === 'cast' ? (
        <EditorWorkspace
          actions={
            <>
              <CastLanguage language={active.language} version={active.version} />
              <LiveStatus />
            </>
          }
          aria-label='Cast code'
          autoOpenSignal={runs.length}
          language={active.language}
          panes={[
            {
              content: (
                <RunHistory
                  emptyHint='Runs appear here as your instructor runs the code.'
                  runs={runs}
                />
              ),
              id: 'history',
              label: 'Run history'
            }
          ]}
          readOnly
          toolbar={viewSwitch}
          value={active.code}
        />
      ) : (
        <Scratchpad defaultLanguage={active.language} slug={slug} toolbar={viewSwitch} />
      )}
    </div>
  )
}
