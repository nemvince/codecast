import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Copy } from '@/components/ui/copy'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { formatExpiry } from '@/lib/format'

interface ShareCastDialogProps {
  expiresAt: string
  open: boolean
  slug: string
  onOpenChange: (open: boolean) => void
}

/**
 * The QR code is the point: a classroom projects this and every student scans their way in, so the
 * code sits on a white panel whatever the app theme is — scanners need dark-on-light.
 */
export const ShareCastDialog = ({ expiresAt, onOpenChange, open, slug }: ShareCastDialogProps) => {
  const shareUrl = `${globalThis.location.origin}/c/${slug}`

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Share this cast</DialogTitle>
          <DialogDescription>
            Anyone with this link can watch, and can run their own code in a private tab. The link
            expires {formatExpiry(expiresAt, Date.now())}.
          </DialogDescription>
        </DialogHeader>

        <div className='flex justify-center rounded-lg bg-white p-4'>
          <QRCodeSVG level='M' size={160} title='Cast link QR code' value={shareUrl} />
        </div>

        <Copy label='Live cast link' url={shareUrl} />

        <DialogFooter>
          <DialogClose render={<Button variant='outline' />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
