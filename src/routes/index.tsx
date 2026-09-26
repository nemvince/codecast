import { ORPCError } from '@orpc/client'
import { BroadcastIcon, ClockIcon, GithubLogoIcon, SignInIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { MyCast } from '@/orpc/schema'
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
import { Badge } from '@/components/ui/badge'
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
import { authClient } from '@/lib/auth/client'
import { formatClock, formatExpiry } from '@/lib/format'
import { markNewCast } from '@/lib/storage'
import { client, orpc } from '@/orpc/client'

const StopCastButton = ({ onStop, pending }: { onStop: () => void; pending: boolean }) => (
  <AlertDialog>
    <AlertDialogTrigger render={<Button disabled={pending} size='sm' variant='outline' />}>
      Stop
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Stop this cast?</AlertDialogTitle>
        <AlertDialogDescription>
          Everyone watching is disconnected and the link stops working. Its run history stays until
          you delete the cast.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onStop} variant='destructive'>
          Stop cast
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)

const DeleteCastButton = ({ onDelete, pending }: { onDelete: () => void; pending: boolean }) => (
  <AlertDialog>
    <AlertDialogTrigger render={<Button disabled={pending} size='sm' variant='destructive' />}>
      Delete
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this cast?</AlertDialogTitle>
        <AlertDialogDescription>
          The cast and its run history are removed for good. The link stops working.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onDelete} variant='destructive'>
          Delete cast
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)

const CastRow = ({
  cast,
  onDelete,
  onStop,
  pending
}: {
  cast: MyCast
  onDelete: (slug: string) => void
  onStop: (slug: string) => void
  pending: boolean
}) => {
  const live = cast.status === 'active'

  return (
    <Item variant='outline'>
      <ItemContent>
        <ItemTitle className='font-mono'>
          <Link
            className='text-foreground no-underline hover:underline'
            params={{ slug: cast.slug }}
            to='/c/$slug'
          >
            {cast.slug}
          </Link>
          <Badge variant={live ? 'default' : 'outline'}>{live ? 'Live' : 'Ended'}</Badge>
        </ItemTitle>
        <ItemDescription>
          {live
            ? `Started ${formatClock(cast.createdAt)} · ends ${formatExpiry(cast.expiresAt, Date.now())}`
            : `Ended ${formatClock(cast.expiresAt)}`}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {live ? (
          <StopCastButton onStop={() => onStop(cast.slug)} pending={pending} />
        ) : (
          <DeleteCastButton onDelete={() => onDelete(cast.slug)} pending={pending} />
        )}
      </ItemActions>
    </Item>
  )
}

const HomePage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session, isPending } = authClient.useSession()

  // Signed out the call would be rejected, so the list is only fetched once a session exists.
  const castsQuery = useQuery({
    ...orpc.listMyCasts.queryOptions({ input: {} }),
    enabled: Boolean(session)
  })
  const casts = castsQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: () => client.createCast({}),
    onSuccess: async (created) => {
      markNewCast(created.slug)
      await queryClient.invalidateQueries({ queryKey: orpc.listMyCasts.key({ input: {} }) })
      void navigate({ params: { slug: created.slug }, to: '/c/$slug' })
    }
  })

  /**
   * Stopping and deleting differ only in the call they make, so they share one mutation: the row
   * that is busy is the one whose button is disabled, and both refresh the same list afterwards.
   */
  const castAction = useMutation({
    mutationFn: ({ run }: { run: () => Promise<unknown>; slug: string }) => run(),
    onError: (error) => {
      toast.error(error instanceof ORPCError ? error.message : 'That did not work.')
    },
    onSettled: async (_data, _error, { slug }) => {
      // Nothing cached about this cast is worth keeping once it is over or gone.
      queryClient.removeQueries({ queryKey: orpc.getCast.key({ input: { slug } }) })
      queryClient.removeQueries({ queryKey: orpc.listRuns.key({ input: { slug } }) })
      await queryClient.invalidateQueries({ queryKey: orpc.listMyCasts.key({ input: {} }) })
    }
  })

  const emptyCasts = session
    ? {
        description: 'Casts you start while signed in show up here.',
        icon: <ClockIcon />,
        title: 'No casts yet'
      }
    : {
        description: 'Casts you start are saved to your account.',
        icon: <SignInIcon />,
        title: 'Sign in to keep your casts'
      }

  let heroAction = (
    <Button
      className='mt-1'
      onClick={() => void authClient.signIn.social({ callbackURL: '/', provider: 'github' })}
      size='lg'
    >
      <GithubLogoIcon />
      Sign in with GitHub
    </Button>
  )

  if (isPending) {
    heroAction = (
      <Button className='mt-1' disabled size='lg'>
        <Spinner />
        Checking…
      </Button>
    )
  } else if (session) {
    heroAction = (
      <Button
        className='mt-1'
        disabled={createMutation.isPending}
        onClick={() => createMutation.mutate()}
        size='lg'
      >
        {createMutation.isPending ? <Spinner /> : <BroadcastIcon />}
        {createMutation.isPending ? 'Starting…' : 'Start a new cast'}
      </Button>
    )
  }

  return (
    <main className='mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 pt-10 pb-16'>
      <section className='flex flex-col items-start gap-3'>
        <h1 className='m-0 text-lg font-semibold tracking-tight'>Run code together, live</h1>
        <p className='text-muted-foreground m-0 text-xs/relaxed'>
          Start a cast and share its link or QR code. Everyone watching sees your code as you type
          it, and can run a copy of their own alongside — theirs stays on their device.
          {session || isPending ? null : ' Joining someone else’s cast never needs an account.'}
        </p>
        {heroAction}

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
        <h2 className='text-muted-foreground m-0 text-xs font-medium'>Your casts</h2>
        {casts.length === 0 ? (
          <Empty className='border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>{emptyCasts.icon}</EmptyMedia>
              <EmptyTitle>{emptyCasts.title}</EmptyTitle>
              <EmptyDescription>{emptyCasts.description}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className='gap-2'>
            {casts.map((cast) => (
              <CastRow
                key={cast.slug}
                cast={cast}
                onDelete={(slug) =>
                  castAction.mutate({ run: () => client.deleteCast({ slug }), slug })
                }
                onStop={(slug) => castAction.mutate({ run: () => client.endCast({ slug }), slug })}
                pending={castAction.isPending}
              />
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
