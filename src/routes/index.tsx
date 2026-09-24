import { ORPCError } from '@orpc/client'
import { ArrowRightIcon, BroadcastIcon, ClockIcon } from '@phosphor-icons/react'
import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { formatClock } from '@/lib/format'
import {
  addRecentCast,
  markNewCast,
  readRecentCasts,
  type RecentCast,
  writeEditKey
} from '@/lib/storage'
import { client } from '@/orpc/client'

const HomePage = () => {
  const navigate = useNavigate()
  const [recent, setRecent] = useState<RecentCast[]>([])

  // Read after mount: the recent list lives in localStorage, which does not exist on the server.
  useEffect(() => {
    setRecent(readRecentCasts())
  }, [])

  const createMutation = useMutation({
    mutationFn: () => client.createCast({}),
    onSuccess: (created) => {
      writeEditKey(created.slug, created.editKey)
      addRecentCast({ createdAt: new Date().toISOString(), slug: created.slug })
      markNewCast(created.slug)
      void navigate({ params: { slug: created.slug }, to: '/c/$slug' })
    }
  })

  return (
    <main className='mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 pt-10 pb-16'>
      <section className='flex flex-col items-start gap-3'>
        <h1 className='m-0 text-lg font-semibold tracking-tight'>Run code together, live</h1>
        <p className='text-muted-foreground m-0 text-xs/relaxed'>
          Start a cast and share its link or QR code. Everyone watching sees your code as you type
          it, and can run a copy of their own alongside — theirs stays on their device.
        </p>
        <Button
          className='mt-1'
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
          size='lg'
        >
          {createMutation.isPending ? <Spinner /> : <BroadcastIcon />}
          {createMutation.isPending ? 'Starting…' : 'Start a new cast'}
        </Button>

        {createMutation.error ? (
          <Alert variant='destructive'>
            <AlertTitle>The cast could not be created</AlertTitle>
            <AlertDescription>
              {createMutation.error instanceof ORPCError
                ? createMutation.error.message
                : 'Please try again.'}
            </AlertDescription>
          </Alert>
        ) : null}
      </section>

      <section className='flex flex-col gap-3'>
        <h2 className='text-muted-foreground m-0 text-xs font-medium'>Recent casts</h2>
        {recent.length === 0 ? (
          <Empty className='border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <ClockIcon />
              </EmptyMedia>
              <EmptyTitle>No casts yet</EmptyTitle>
              <EmptyDescription>Casts you start in this browser show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className='gap-2'>
            {recent.map((cast) => (
              <Item
                key={cast.slug}
                render={<Link params={{ slug: cast.slug }} to='/c/$slug' />}
                variant='outline'
              >
                <ItemContent>
                  <ItemTitle className='font-mono'>{cast.slug}</ItemTitle>
                  <ItemDescription>Started {formatClock(cast.createdAt)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ArrowRightIcon className='text-muted-foreground' />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>
    </main>
  )
}

export const Route = createFileRoute('/')({
  component: HomePage
})
