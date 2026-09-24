import { CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeEditor } from '@/integrations/codemirror/code-editor'

export interface EditorPane {
  id: string
  label: string
  content: ReactNode
}

interface EditorWorkspaceProps {
  'aria-label': string
  actions?: ReactNode
  autoOpenSignal?: number
  language: string
  panes: EditorPane[]
  readOnly?: boolean
  toolbar?: ReactNode
  value: string
  onRun?: () => void
  onValueChange?: (value: string) => void
}

/**
 * The code, its settings and the run panel share one surface. Opening the panel takes height from
 * the editor, the way a bottom panel does in an IDE, and the panel opens itself when a run lands.
 */
export const EditorWorkspace = ({
  actions,
  'aria-label': ariaLabel,
  autoOpenSignal = 0,
  language,
  onRun,
  onValueChange,
  panes,
  readOnly,
  toolbar,
  value
}: EditorWorkspaceProps) => {
  const [open, setOpen] = useState(autoOpenSignal > 0)
  const [pane, setPane] = useState(panes[0]?.id ?? '')

  useEffect(() => {
    if (autoOpenSignal > 0) {
      setOpen(true)
    }
  }, [autoOpenSignal])

  return (
    <div className='bg-card flex grow flex-col overflow-hidden'>
      <div className='flex flex-wrap items-center gap-1.5 border-b px-2 py-1.5'>
        {toolbar}
        {actions ? <div className='ml-auto flex items-center gap-1.5'>{actions}</div> : null}
      </div>

      <div className='min-h-0 flex-1'>
        <CodeEditor
          aria-label={ariaLabel}
          className='h-full'
          language={language}
          onChange={onValueChange}
          onRun={onRun}
          readOnly={readOnly}
          value={value}
        />
      </div>

      <Tabs className='gap-0' onValueChange={setPane} value={pane}>
        <div className='flex items-center gap-1 border-t px-1.5 py-1'>
          <TabsList className='h-7' variant='line'>
            {panes.map((entry) => (
              <TabsTrigger key={entry.id} value={entry.id}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            aria-expanded={open}
            aria-label={open ? 'Hide run panel' : 'Show run panel'}
            className='ml-auto'
            onClick={() => setOpen(!open)}
            size='icon-sm'
            variant='ghost'
          >
            {open ? <CaretDownIcon /> : <CaretUpIcon />}
          </Button>
        </div>

        {open
          ? panes.map((entry) => (
              <TabsContent
                className='flex max-h-64 min-h-48 flex-col border-t'
                key={entry.id}
                value={entry.id}
              >
                {entry.content}
              </TabsContent>
            ))
          : null}
      </Tabs>
    </div>
  )
}
