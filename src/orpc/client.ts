import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { ClientRetryPlugin, type ClientRetryPluginContext } from '@orpc/client/plugins'
import { createRouterClient, type RouterClient } from '@orpc/server'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import router from '@/orpc/router'

const getORPCClient = createIsomorphicFn()
  .server((): RouterClient<typeof router, ClientRetryPluginContext> =>
    createRouterClient(router, {
      context: () => ({
        headers: getRequestHeaders()
      })
    })
  )
  .client((): RouterClient<typeof router, ClientRetryPluginContext> => {
    const link = new RPCLink<ClientRetryPluginContext>({
      plugins: [new ClientRetryPlugin()],
      url: `${globalThis.location.origin}/api/rpc`
    })
    return createORPCClient(link)
  })

export const client: RouterClient<typeof router, ClientRetryPluginContext> = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
