import { consumeEventIterator } from '@orpc/client'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { CastEventKind } from '@/orpc/schema'
import { client, orpc } from '@/orpc/client'

/**
 * Follows the server's change feed for one cast, so a viewer sees the instructor's code and runs the
 * moment they change rather than on the next poll. The link reconnects the stream by itself; a
 * reconnect refetches everything the feed could have missed while it was down.
 */
export const useCastStream = (slug: string) => {
  const queryClient = useQueryClient()

  useEffect(() => {
    const keys = {
      cast: orpc.getCast.key({ input: { slug } }),
      runs: orpc.listRuns.key({ input: { slug } })
    }
    const invalidate = (kind: CastEventKind) => {
      void queryClient.invalidateQueries({ queryKey: keys[kind] })
    }

    const cancel = consumeEventIterator(
      client.watchCast(
        { slug },
        {
          context: {
            onRetry: () => (reconnected) => {
              if (reconnected) {
                invalidate('cast')
                invalidate('runs')
              }
            },
            retry: Number.POSITIVE_INFINITY
          }
        }
      ),
      {
        onError: (error) => {
          /**
           * An endless stream only fails this way once it has been cancelled: there is no feed left
           * to follow, and the page still holds the state it fetched.
           */
          if (!(error instanceof Error && error.name === 'AbortError')) {
            console.error(error)
          }
        },
        onEvent: (event) => invalidate(event.kind)
      }
    )

    return () => {
      void cancel()
    }
  }, [queryClient, slug])
}
