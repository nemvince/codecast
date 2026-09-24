import { TerminalIcon } from '@phosphor-icons/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import type { Language, RunResult } from '@/orpc/schema'
import { RunOutput } from '@/components/editor/run/output'
import { LanguageMenu, RunButton, StdinPopover } from '@/components/editor/toolbar'
import { EditorWorkspace } from '@/components/editor/workspace'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { findLanguage } from '@/lib/languages'
import { readScratch, readScratchLanguage, writeScratch, writeScratchLanguage } from '@/lib/storage'
import { client, orpc } from '@/orpc/client'

interface ScratchpadProps {
  slug: string
  defaultLanguage: string
  /** Leading toolbar content, so the viewer can put its view switch beside the privacy note. */
  toolbar?: ReactNode
}

/**
 * Only installed runtimes are offered, so preference order is decided against the engine's list:
 * the student's last choice, then the cast's language, then whatever the engine has.
 */
const pickLanguage = (languages: Language[], preferred: (string | null)[]): string => {
  const chosen = preferred.find(
    (candidate) => candidate !== null && languages.some((entry) => entry.id === candidate)
  )

  return chosen ?? languages[0]?.id ?? ''
}

export const Scratchpad = ({ defaultLanguage, slug, toolbar }: ScratchpadProps) => {
  const languagesQuery = useQuery(orpc.listLanguages.queryOptions({ input: {} }))
  const languages = languagesQuery.data ?? []
  const [language, setLanguage] = useState('')
  const [code, setCode] = useState('')
  const [stdin, setStdin] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [runCount, setRunCount] = useState(0)

  useEffect(() => {
    if (language || languages.length === 0) {
      return
    }

    setLanguage(pickLanguage(languages, [readScratchLanguage(slug), defaultLanguage]))
  }, [defaultLanguage, language, languages, slug])

  useEffect(() => {
    if (!language) {
      return
    }

    setCode(readScratch(slug, language, 'code') ?? findLanguage(language)?.starter ?? '')
    setStdin(readScratch(slug, language, 'stdin') ?? '')
  }, [language, slug])

  const version = languages.find((entry) => entry.id === language)?.version ?? ''

  const runMutation = useMutation({
    mutationFn: () => client.runScratchCode({ code, language, stdin, version }),
    onSuccess: (data) => {
      setResult(data)
      setRunCount((current) => current + 1)
    }
  })

  const handleCodeChange = (value: string) => {
    setCode(value)
    writeScratch(slug, language, { field: 'code', value })
  }

  const handleStdinChange = (value: string) => {
    setStdin(value)
    writeScratch(slug, language, { field: 'stdin', value })
  }

  const handleLanguageChange = (nextId: string) => {
    writeScratchLanguage(slug, nextId)
    setLanguage(nextId)
  }

  return (
    <div className='flex grow flex-col gap-4'>
      {runMutation.error ? (
        <Alert variant='destructive'>
          <AlertTitle>That run did not complete</AlertTitle>
          <AlertDescription>
            {runMutation.error instanceof Error
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
              languages={languages}
              onChange={handleLanguageChange}
              value={language}
            />
            <StdinPopover onChange={handleStdinChange} value={stdin} />
            <RunButton
              disabled={!language}
              hint='Run your code'
              onRun={() => runMutation.mutate()}
              running={runMutation.isPending}
            />
          </>
        }
        aria-label='Your code'
        autoOpenSignal={runCount}
        language={language}
        onRun={() => runMutation.mutate()}
        onValueChange={handleCodeChange}
        panes={[
          {
            content: result ? (
              <RunOutput run={result} />
            ) : (
              <Empty className='border-0'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <TerminalIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nothing yet</EmptyTitle>
                  <EmptyDescription>Press Run to try your code.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ),
            id: 'output',
            label: 'Output'
          }
        ]}
        toolbar={
          <>
            {toolbar}
            <span className='text-muted-foreground px-1 text-xs'>
              Your code and output stay on this device. The instructor cannot see them.
            </span>
          </>
        }
        value={code}
      />
    </div>
  )
}
