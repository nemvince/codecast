import { ORPCError } from '@orpc/client'
import {
  StopCircleIcon,
  WarningCircleIcon,
  FloppyDiskIcon,
  WarningDiamondIcon,
  ShareFatIcon
} from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CastView } from '@/orpc/schema'
import { RunHistory } from '@/components/editor/run/history'
import { LanguageMenu, RunButton, StdinPopover } from '@/components/editor/toolbar'
import { EditorWorkspace } from '@/components/editor/workspace'
import { ShareCastDialog } from '@/components/share-cast-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { findLanguage } from '@/lib/languages'
import { runsQueryOptions } from '@/lib/queries'
import { consumeNewCast } from '@/lib/storage'
import { client, orpc } from '@/orpc/client'

interface CastEditorProps {
  slug: string
  initial: CastView
}

interface CastDraft {
  code: string
  language: string
  stdin: string
  version: string
}

type SavableField = keyof CastDraft
type SaveState = 'saved' | 'saving' | 'failed'

const SAVE_INDICATOR: Record<SaveState, { className: string; label: string; icon: ReactNode }> = {
  failed: {
    className: 'text-destructive',
    icon: <WarningDiamondIcon />,
    label: "Couldn't save"
  },
  saved: {
    className: 'text-emerald-600 dark:text-emerald-500',
    icon: <FloppyDiskIcon />,
    label: 'Your code is auto-saved'
  },
  saving: {
    className: 'animate-pulse text-muted-foreground motion-reduce:animate-none',
    icon: <Spinner />,
    label: 'Saving...'
  }
}

/** Short enough that viewers track typing, long enough to coalesce a burst of keystrokes. */
const AUTOSAVE_DELAY_MS = 200

/**
 * The instructor's draft is the source of truth: only the fields the instructor actually touched
 * are sent, so polling can never write polled data back over what is being typed.
 */
const useAutosave = (slug: string, draft: CastDraft) => {
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [lostAccess, setLostAccess] = useState(false)
  const dirtyFields = useRef(new Set<SavableField>())
  const { code, language, stdin, version } = draft

  const payloadFor = (fields: Set<SavableField>): Parameters<typeof client.updateCast>[0] => {
    const payload: Parameters<typeof client.updateCast>[0] = { slug }

    if (fields.has('code')) {
      payload.code = code
    }
    if (fields.has('language')) {
      payload.language = language
    }
    if (fields.has('stdin')) {
      payload.stdin = stdin
    }
    if (fields.has('version')) {
      payload.version = version
    }

    return payload
  }

  const reportSaveFailure = (error: unknown) => {
    setSaveState('failed')
    if (error instanceof ORPCError && error.code === 'FORBIDDEN') {
      setLostAccess(true)
    }
  }

  useEffect(() => {
    if (dirtyFields.current.size === 0) {
      return
    }

    const fields = new Set(dirtyFields.current)
    setSaveState('saving')

    const timer = setTimeout(async () => {
      dirtyFields.current.clear()

      try {
        await client.updateCast(payloadFor(fields))
        setSaveState('saved')
      } catch (error) {
        reportSaveFailure(error)
      }
    }, AUTOSAVE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [code, language, slug, stdin, version])

  return { dirtyFields, lostAccess, reportSaveFailure, saveState, setSaveState }
}

export const CastEditor = ({ initial, slug }: CastEditorProps) => {
  const queryClient = useQueryClient()
  const [code, setCode] = useState(initial.code)
  const [stdin, setStdin] = useState(initial.stdin)
  const [language, setLanguage] = useState(initial.language)
  const [version, setVersion] = useState(initial.version)
  const [confirmingEnd, setConfirmingEnd] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const languagesQuery = useQuery(orpc.listLanguages.queryOptions({ input: {} }))
  const castQuery = useQuery(orpc.getCast.queryOptions({ input: { slug } }))
  const state = castQuery.data ?? { cast: initial, status: 'active' as const }
  const latestRunId = state.status === 'active' ? state.cast.latestRunId : initial.latestRunId
  const expiresAt = state.status === 'active' ? state.cast.expiresAt : initial.expiresAt
  const runsQuery = useQuery(runsQueryOptions(slug, latestRunId))
  const runs = runsQuery.data ?? []
  const { dirtyFields, lostAccess, reportSaveFailure, saveState, setSaveState } = useAutosave(
    slug,
    {
      code,
      language,
      stdin,
      version
    }
  )

  // A cast created in this browser offers its link once, as soon as the editor is on screen.
  useEffect(() => {
    if (consumeNewCast(slug)) {
      setShareOpen(true)
    }
  }, [slug])

  const runMutation = useMutation({
    mutationFn: () => client.runCastCode({ code, slug, stdin }),
    onSuccess: async () => {
      dirtyFields.current.clear()
      await queryClient.invalidateQueries({ queryKey: orpc.listRuns.key({ input: { slug } }) })
      await queryClient.invalidateQueries({ queryKey: orpc.getCast.key({ input: { slug } }) })
    }
  })

  const endMutation = useMutation({
    mutationFn: () => client.endCast({ slug }),
    onSuccess: async () => {
      setConfirmingEnd(false)
      await queryClient.invalidateQueries({ queryKey: orpc.getCast.key({ input: { slug } }) })
    }
  })

  const handleCodeChange = (value: string) => {
    dirtyFields.current.add('code')
    setCode(value)
  }

  const handleStdinChange = (value: string) => {
    dirtyFields.current.add('stdin')
    setStdin(value)
  }

  // A language switch is one write: the new starter and an empty stdin belong with it.
  const handleLanguageChange = async (nextId: string) => {
    const next = languagesQuery.data?.find((entry) => entry.id === nextId)
    if (!next) {
      return
    }

    const starter = findLanguage(nextId)?.starter ?? ''
    dirtyFields.current.clear()
    setLanguage(next.id)
    setVersion(next.version)
    setCode(starter)
    setStdin('')

    await client
      .updateCast({
        code: starter,
        language: next.id,
        slug,
        stdin: '',
        version: next.version
      })
      .then(() => setSaveState('saved'))
      .catch((error: unknown) => reportSaveFailure(error))
  }

  return (
    <div className='flex grow flex-col gap-4'>
      {lostAccess ? (
        <Alert variant='destructive'>
          <WarningCircleIcon />
          <AlertTitle>You no longer have editing access to this cast</AlertTitle>
          <AlertDescription>
            Sign in with the account that started this cast to keep editing it.
          </AlertDescription>
        </Alert>
      ) : null}

      {runMutation.error ? (
        <Alert variant='destructive'>
          <AlertTitle>That run did not complete</AlertTitle>
          <AlertDescription>
            {runMutation.error instanceof ORPCError
              ? runMutation.error.message
              : 'The run could not be completed.'}
          </AlertDescription>
        </Alert>
      ) : null}

      <EditorWorkspace
        actions={
          <>
            <LanguageMenu
              disabled={runMutation.isPending}
              languages={languagesQuery.data ?? []}
              onChange={handleLanguageChange}
              value={language}
            />
            <StdinPopover onChange={handleStdinChange} value={stdin} />
            <RunButton
              disabled={runMutation.isPending}
              hint='Run the cast code'
              onRun={() => runMutation.mutate()}
              running={runMutation.isPending}
            />
          </>
        }
        aria-label='Cast code'
        autoOpenSignal={runs.length}
        language={language}
        onRun={() => runMutation.mutate()}
        onValueChange={handleCodeChange}
        panes={[{ content: <RunHistory runs={runs} />, id: 'history', label: 'Run history' }]}
        toolbar={
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    aria-label={SAVE_INDICATOR[saveState].label}
                    className={`flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4 ${SAVE_INDICATOR[saveState].className}`}
                    role='status'
                    tabIndex={0}
                  />
                }
              >
                {SAVE_INDICATOR[saveState].icon}
              </TooltipTrigger>
              <TooltipContent>{SAVE_INDICATOR[saveState].label}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label='Share cast link'
                    onClick={() => setShareOpen(true)}
                    size='icon-lg'
                    variant='ghost'
                  />
                }
              >
                <ShareFatIcon />
              </TooltipTrigger>
              <TooltipContent>Share cast link</TooltipContent>
            </Tooltip>

            <AlertDialog onOpenChange={setConfirmingEnd} open={confirmingEnd}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <AlertDialogTrigger
                      render={
                        <Button
                          aria-label='End cast'
                          className='text-destructive hover:text-destructive'
                          size='icon-lg'
                          variant='ghost'
                        />
                      }
                    />
                  }
                >
                  <StopCircleIcon />
                </TooltipTrigger>
                <TooltipContent>End cast</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End this cast?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The link stops working immediately, and students can no longer watch or run
                    code. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it open</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={endMutation.isPending}
                    onClick={() => endMutation.mutate()}
                    variant='destructive'
                  >
                    {endMutation.isPending ? <Spinner /> : null}
                    Yes, end it
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
        value={code}
      />

      <ShareCastDialog
        expiresAt={expiresAt}
        onOpenChange={setShareOpen}
        open={shareOpen}
        slug={slug}
      />
    </div>
  )
}
