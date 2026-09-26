import { LockIcon } from '@phosphor-icons/react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { type ReactNode, useDeferredValue, useState } from 'react'
import { toast } from 'sonner'
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { authClient } from '@/lib/auth/client'

const PAGE_SIZE = 20

interface AdminUserRow {
  banned: boolean | null
  email: string
  id: string
  name: string
  role?: null | string
}

/** Every action resolves to the same better-auth envelope, so one mutation can drive all of them. */
type AdminAction = () => Promise<{ error: { message?: string } | null }>

const BanButton = ({
  onBan,
  pending,
  userId
}: {
  onBan: (userId: string, reason: string) => void
  pending: boolean
  userId: string
}) => {
  const [reason, setReason] = useState('')

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button disabled={pending} size='sm' variant='destructive' />}>
        Ban
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ban this user?</AlertDialogTitle>
          <AlertDialogDescription>
            They are signed out everywhere and cannot sign in again until you unban them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          aria-label='Ban reason'
          onChange={(event) => setReason(event.target.value)}
          placeholder='Reason (optional)'
          value={reason}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onBan(userId, reason)} variant='destructive'>
            Ban user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const AdminUserItem = ({
  onBan,
  onSetRole,
  onUnban,
  pending,
  selfId,
  user
}: {
  onBan: (userId: string, reason: string) => void
  onSetRole: (userId: string, role: 'admin' | 'user') => void
  onUnban: (userId: string) => void
  pending: boolean
  selfId: string
  user: AdminUserRow
}) => {
  const isAdmin = user.role === 'admin'
  const isSelf = user.id === selfId

  return (
    <Item variant='outline'>
      <ItemContent>
        <ItemTitle>
          {user.name}
          {isSelf ? <Badge variant='secondary'>You</Badge> : null}
        </ItemTitle>
        <ItemDescription>{user.email}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant={isAdmin ? 'default' : 'outline'}>{isAdmin ? 'Admin' : 'User'}</Badge>
        {user.banned ? <Badge variant='destructive'>Banned</Badge> : null}
        {isSelf ? null : (
          <>
            <Button
              disabled={pending}
              onClick={() => onSetRole(user.id, isAdmin ? 'user' : 'admin')}
              size='sm'
              variant='outline'
            >
              {isAdmin ? 'Revoke admin' : 'Make admin'}
            </Button>
            {user.banned ? (
              <Button
                disabled={pending}
                onClick={() => onUnban(user.id)}
                size='sm'
                variant='outline'
              >
                Unban
              </Button>
            ) : (
              <BanButton onBan={onBan} pending={pending} userId={user.id} />
            )}
          </>
        )}
      </ItemActions>
    </Item>
  )
}

const AdminPage = () => {
  const queryClient = useQueryClient()
  const { data: session, isPending } = authClient.useSession()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const deferredSearch = useDeferredValue(search)
  const isAdmin = session?.user.role === 'admin'

  const usersQuery = useQuery({
    enabled: isAdmin,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await authClient.admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          searchValue: deferredSearch || undefined,
          sortBy: 'createdAt',
          sortDirection: 'desc'
        }
      })
      if (error) {
        throw new Error(error.message ?? 'Users could not be loaded.')
      }

      return data
    },
    queryKey: ['admin', 'users', page, deferredSearch]
  })

  const action = useMutation({
    mutationFn: async (run: AdminAction) => {
      const { error } = await run()
      if (error) {
        throw new Error(error.message ?? 'The action failed.')
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    }
  })

  if (isPending) {
    return (
      <main className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-10 pb-16'>
        <Skeleton className='h-64 rounded-lg' />
      </main>
    )
  }

  // The gate is UX only: every admin endpoint enforces the permission server-side too.
  if (!isAdmin) {
    return (
      <main className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-10 pb-16'>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <LockIcon />
            </EmptyMedia>
            <EmptyTitle>Admins only</EmptyTitle>
            <EmptyDescription>
              {session
                ? 'Your account does not have admin access.'
                : 'Sign in with GitHub with an admin account to manage users.'}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant='link' render={<Link to='/' />}>
              Back to casts
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    )
  }

  const total = usersQuery.data?.total ?? 0

  let body: ReactNode = null

  if (usersQuery.isPending) {
    body = (
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-12' />
        <Skeleton className='h-12' />
        <Skeleton className='h-12' />
      </div>
    )
  } else if (usersQuery.error) {
    body = (
      <Alert variant='destructive'>
        <AlertTitle>Users could not be loaded</AlertTitle>
        <AlertDescription>{usersQuery.error.message}</AlertDescription>
      </Alert>
    )
  } else {
    body = (
      <ItemGroup className='gap-2'>
        {usersQuery.data.users.map((user) => (
          <AdminUserItem
            key={user.id}
            onBan={(userId, reason) =>
              action.mutate(() =>
                authClient.admin.banUser({ banReason: reason.trim() || undefined, userId })
              )
            }
            onSetRole={(userId, role) =>
              action.mutate(() => authClient.admin.setRole({ role, userId }))
            }
            onUnban={(userId) => action.mutate(() => authClient.admin.unbanUser({ userId }))}
            pending={action.isPending}
            selfId={session.user.id}
            user={user}
          />
        ))}
      </ItemGroup>
    )
  }

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-10 pb-16'>
      <div className='flex flex-col gap-1'>
        <h1 className='m-0 text-lg font-semibold tracking-tight'>Users</h1>
        <p className='text-muted-foreground m-0 text-xs'>{total} accounts</p>
      </div>

      <Input
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(0)
        }}
        placeholder='Search by email…'
        value={search}
      />

      {body}

      <div className='flex items-center gap-2'>
        {page > 0 ? (
          <Button onClick={() => setPage(page - 1)} size='sm' variant='outline'>
            Previous
          </Button>
        ) : null}
        {(page + 1) * PAGE_SIZE < total ? (
          <Button onClick={() => setPage(page + 1)} size='sm' variant='outline'>
            Next
          </Button>
        ) : null}
        <span className='text-muted-foreground ml-auto text-xs'>Page {page + 1}</span>
      </div>
    </main>
  )
}

export const Route = createFileRoute('/admin')({
  component: AdminPage,
  head: () => ({ meta: [{ title: 'Users — CodeCast' }] })
})
