import type { ReactNode } from 'react'
import { CaretDownIcon, GithubLogoIcon } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth/client'

const NAV_LINK = 'rounded-md px-2 py-1 text-xs font-medium no-underline transition-colors'

export const Header = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session, isPending } = authClient.useSession()

  const handleSignOut = async () => {
    /**
     * SignOut refreshes useSession on its own. Every cached answer was resolved for the account that
     * just left — the cast list and each cast's ownership among them — so none of it may survive.
     */
    await authClient.signOut()
    queryClient.removeQueries()
    await router.invalidate()
  }

  let authSlot: ReactNode = null

  if (session) {
    authSlot = (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size='sm' variant='outline' />}>
          {session.user.name}
          <CaretDownIcon className='text-muted-foreground' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {/* Base UI's GroupLabel must live inside a Group. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>{session.user.email}</DropdownMenuLabel>
            {session.user.role === 'admin' ? (
              <DropdownMenuItem render={<Link to='/admin' />}>Admin</DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void handleSignOut()}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  } else if (!isPending) {
    authSlot = (
      <Button
        onClick={() => void authClient.signIn.social({ callbackURL: '/', provider: 'github' })}
        size='sm'
        variant='outline'
      >
        <GithubLogoIcon />
        Sign in
      </Button>
    )
  }

  return (
    <header className='border-border bg-background/80 sticky top-0 z-50 border-b px-4 backdrop-blur-lg'>
      <nav className='flex flex-wrap items-center gap-x-4 gap-y-2 py-3'>
        <h2 className='m-0 shrink-0 text-sm font-semibold tracking-tight'>
          <Link className='text-foreground flex items-center gap-2 no-underline' to='/'>
            CodeCast
          </Link>
        </h2>

        <Link
          activeOptions={{ exact: true }}
          activeProps={{ className: 'bg-muted text-foreground' }}
          className={`${NAV_LINK} text-muted-foreground hover:text-foreground`}
          to='/'
        >
          Home
        </Link>

        <div className='ml-auto flex items-center gap-2'>
          {authSlot}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
