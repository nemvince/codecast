import { CheckIcon, ClipboardIcon } from '@phosphor-icons/react'
import { cn } from 'cn'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'

export const Copy = ({
  className,
  url,
  label,
  ...props
}: {
  url: string
  label: string
} & React.ComponentProps<'div'>) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await globalThis.navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    } catch {
      toast.error('Could not copy — please select and copy manually')
    }
  }

  return (
    <InputGroup className={cn(className)} {...props}>
      <InputGroupInput aria-label={label} className='font-mono' readOnly value={url} />
      <InputGroupAddon align='inline-end'>
        <InputGroupButton onClick={handleCopy} size='xs'>
          {copied ? (
            <>
              <CheckIcon />
              Copied
            </>
          ) : (
            <>
              <ClipboardIcon />
              Copy
            </>
          )}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
