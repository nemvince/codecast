import { BroadcastIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { CastEditor } from '@/components/cast-editor'
import { CastViewer } from '@/components/cast-viewer'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { useCastStream } from '@/lib/cast'
import { slugSchema } from '@/lib/cast/slug'
import { runsQueryOptions } from '@/lib/queries'
import { orpc } from '@/orpc/client'

const CastPage = ({ children }: { children: React.ReactNode }) => (
  <main className='flex grow flex-col'>{children}</main>
)

const NotFoundPanel = () => (
  <CastPage>
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant='icon' className='text-destructive'>
          <WarningCircleIcon />
        </EmptyMedia>
        <EmptyTitle>That link is not valid or has expired</EmptyTitle>
        <EmptyDescription>
          Ask your instructor for a fresh link, or start a cast of your own.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant='link' render={<Link to='/' />}>
          <BroadcastIcon />
          Start a new cast
        </Button>
      </EmptyContent>
    </Empty>
  </CastPage>
)

const CastRoute = () => {
  const { slug } = Route.useParams()
  const loaderState = Route.useLoaderData()
  const castQuery = useQuery(orpc.getCast.queryOptions({ input: { slug } }))
  const state = castQuery.data ?? loaderState

  useCastStream(slug)

  if (state.status === 'missing') {
    return <NotFoundPanel />
  }
  if (state.status === 'ended') {
    return (
      <CastPage>
        <CastViewer slug={slug} />
      </CastPage>
    )
  }
  if (state.cast.isOwner) {
    return (
      <CastPage>
        <CastEditor initial={state.cast} slug={slug} />
      </CastPage>
    )
  }

  return (
    <CastPage>
      <CastViewer slug={slug} />
    </CastPage>
  )
}

export const Route = createFileRoute('/c/$slug')({
  component: CastRoute,
  head: () => ({
    meta: [{ title: 'Live cast — CodeCast' }]
  }),
  loader: async ({ context, params }) => {
    const { slug } = params

    // A link that is not even shaped like a cast cannot name one: that is a bad link, not a failure.
    if (!slugSchema.safeParse(slug).success) {
      throw notFound()
    }

    const state = await context.queryClient.query(
      orpc.getCast.queryOptions({ input: { slug }, staleTime: 'static' })
    )

    if (state.status === 'missing') {
      throw notFound()
    }
    if (state.status === 'active') {
      // Prefetch under the same cursor key the components read, or the history starts empty.
      await context.queryClient.query({
        ...runsQueryOptions(slug, state.cast.latestRunId),
        staleTime: 'static'
      })
    }

    return state
  },
  notFoundComponent: NotFoundPanel
})
