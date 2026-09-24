import { Link } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/theme-toggle'

const NAV_LINK = 'rounded-md px-2 py-1 text-xs font-medium no-underline transition-colors'

export const Header = () => (
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
        <ThemeToggle />
      </div>
    </nav>
  </header>
)
