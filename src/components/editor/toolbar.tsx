import {
  FileCIcon,
  FileCodeIcon,
  FileCppIcon,
  FileJsIcon,
  FilePyIcon,
  FileRsIcon,
  FileTsIcon,
  PlayIcon,
  TextboxIcon
} from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface LanguageOption {
  id: string
  label: string
}

/** Phosphor ships no Java or Go file icon, so those fall back to the generic code icon. */
const LANGUAGE_ICONS: Record<string, ReactNode> = {
  c: <FileCIcon />,
  'c++': <FileCppIcon />,
  javascript: <FileJsIcon />,
  python: <FilePyIcon />,
  rust: <FileRsIcon />,
  typescript: <FileTsIcon />
}

export const languageIcon = (id: string): ReactNode => LANGUAGE_ICONS[id] ?? <FileCodeIcon />

interface LanguageMenuProps {
  disabled?: boolean
  languages: LanguageOption[]
  value: string
  onChange: (id: string) => void
}

export const LanguageMenu = ({ disabled, languages, onChange, value }: LanguageMenuProps) => {
  const current = languages.find((language) => language.id === value)?.label ?? 'Loading languages…'

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`Code language: ${current}`}
                  disabled={disabled}
                  size='icon-lg'
                  variant='ghost'
                />
              }
            />
          }
        >
          {languageIcon(value)}
        </TooltipTrigger>
        <TooltipContent>{current}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align='end'>
        <DropdownMenuRadioGroup onValueChange={onChange} value={value}>
          {languages.map((language) => (
            <DropdownMenuRadioItem key={language.id} value={language.id}>
              {languageIcon(language.id)}
              {language.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface StdinPopoverProps {
  value: string
  onChange: (value: string) => void
}

export const StdinPopover = ({ onChange, value }: StdinPopoverProps) => {
  const [open, setOpen] = useState(false)
  const filled = value.trim().length > 0

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  aria-label={`Program input (stdin): ${filled ? 'set' : 'empty'}`}
                  className='relative'
                  size='icon-lg'
                  variant={open ? 'secondary' : 'ghost'}
                />
              }
            />
          }
        >
          <TextboxIcon />
          {filled ? (
            <span
              aria-hidden='true'
              className='bg-primary ring-card absolute top-0 right-0 size-2 rounded-full ring-2'
            />
          ) : null}
        </TooltipTrigger>
        <TooltipContent>Program input (stdin)</TooltipContent>
      </Tooltip>
      <PopoverContent align='end' className='w-80'>
        <PopoverHeader>
          <PopoverTitle>Program input</PopoverTitle>
          <PopoverDescription>
            Piped to the program on stdin. Leave it empty when the program reads nothing.
          </PopoverDescription>
        </PopoverHeader>
        <Textarea
          aria-label='Program input (stdin)'
          className='font-mono'
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      </PopoverContent>
    </Popover>
  )
}

interface RunButtonProps {
  disabled?: boolean
  hint: string
  running: boolean
  onRun: () => void
}

export const RunButton = ({ disabled, hint, onRun, running }: RunButtonProps) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          aria-label={running ? 'Running' : 'Run'}
          className='bg-emerald-600 text-white hover:bg-emerald-700 dark:hover:bg-emerald-500'
          disabled={disabled || running}
          onClick={onRun}
          size='icon-lg'
        />
      }
    >
      {running ? <Spinner /> : <PlayIcon />}
    </TooltipTrigger>
    <TooltipContent>
      {hint}
      <KbdGroup>
        <Kbd>Ctrl/⌘</Kbd>
        <Kbd>Enter</Kbd>
      </KbdGroup>
    </TooltipContent>
  </Tooltip>
)
