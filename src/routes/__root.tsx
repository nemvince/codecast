import type { QueryClient } from '@tanstack/react-query'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { Header } from '@/components/header'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import TanStackQueryDevtools from '@/integrations/tanstack-query/devtools'
import appCss from '@/styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

/**
 * Self-hosted Umami: page views, plus the session recorder. Vite inlines `import.meta.env.VITE_*`
 * into both bundles, so the id is fixed when the build runs — a build without the variable ships
 * without analytics rather than failing, and no tag is emitted until it is set.
 *
 * Rendered by the shell rather than in `head()`, which is re-applied on every client-side
 * navigation: there the tags are re-inserted and re-executed, so each in-app link click sent another
 * pair of page views. The shell renders once per document, like the theme script below it.
 */
const UMAMI_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    links: [
      {
        href: appCss,
        rel: 'stylesheet'
      }
    ],
    meta: [
      {
        charSet: 'utf8'
      },
      {
        content: 'width=device-width, initial-scale=1',
        name: 'viewport'
      },
      {
        title: 'CodeCast'
      }
    ]
  }),
  shellComponent: ({ children }: { children: React.ReactNode }) => (
    <html lang='en' className='bg-background text-foreground h-dvh' suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {UMAMI_ID ? (
          <>
            <script data-website-id={UMAMI_ID} defer src='https://umat.vnce.eu/script.js' />
            <script data-website-id={UMAMI_ID} defer src='https://umat.vnce.eu/recorder.js' />
          </>
        ) : null}
        <HeadContent />
      </head>
      <body className='flex h-full flex-col font-sans antialiased'>
        <TooltipProvider>
          <Header />
          {children}
        </TooltipProvider>
        <Toaster />
        <TanStackDevtools
          config={{
            position: 'bottom-right'
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />
            },
            TanStackQueryDevtools
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
})
