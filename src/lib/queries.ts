import { keepPreviousData } from '@tanstack/react-query'
import { orpc } from '@/orpc/client'

/**
 * The cursor in the key fetches runs once per new run instead of re-sending every run's output, and
 * keeping the previous page means a new run extends the visible history instead of blanking it.
 */
export const runsQueryOptions = (slug: string, cursor: string | null) => {
  const base = orpc.listRuns.queryOptions({ input: { slug } })

  return { ...base, placeholderData: keepPreviousData, queryKey: [...base.queryKey, cursor] }
}
