import { BroadcastIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useCastStream } from '@/lib/cast'
import { slugSchema } from '@/lib/cast/slug'
import { runsQueryOptions } from '@/lib/queries'
import { readEditKey } from '@/lib/storage'
import { orpc } from '@/orpc/client'

const CastPage = ({ children }: { children: React.ReactNode }) => (
  <main className='flex grow flex-col'>{children}</main>
)

const LoadingPanel = () => (
  <CastPage>
    <Skeleton className='grow rounded-none' />
  </CastPage>
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

/** Read after mount: the edit key lives in localStorage, which does not exist on the server. */
const useEditAccess = (slug: string) => {
  const [access, setAccess] = useState<{ editKey: string | null; mounted: boolean }>({
    editKey: null,
    mounted: false
  })

  useEffect(() => {
    setAccess({ editKey: readEditKey(slug), mounted: true })
  }, [slug])

  return access
}

const CastRoute = () => {
  const { slug } = Route.useParams()
  const loaderState = Route.useLoaderData()
  const castQuery = useQuery(orpc.getCast.queryOptions({ input: { slug } }))
  const state = castQuery.data ?? loaderState
  const { editKey, mounted } = useEditAccess(slug)

  useCastStream(slug)

  if (!mounted) {
    return <LoadingPanel />
  }
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
  if (editKey) {
    return (
      <CastPage>
        <CastEditor editKey={editKey} initial={state.cast} slug={slug} />
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
