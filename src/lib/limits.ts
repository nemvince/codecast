import { MemoryRateLimiter } from '@orpc/ratelimit/memory'

/**
 * Which client a limit applies to. A visitor can set `x-forwarded-for` themselves, so the reverse
 * proxy in front of this app must overwrite it: a header the visitor controls is a limit the
 * visitor can lift. Behind a proxy that does not, every visitor shares the `unknown` key.
 */
export const clientKey = (headers: Headers): string =>
  headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

const MINUTE_MS = 60_000

/**
 * Running code is the only expensive thing a visitor can ask for, so it is the only thing that is
 * metered. The window is deliberately wide: a class behind one NAT address shares one key, and a
 * lesson where everyone runs the example must not trip it. What actually bounds a flood is Piston's
 * own `MAX_CONCURRENT_JOBS`; this stops one client from quietly holding the whole engine.
 */
export const runLimiter = new MemoryRateLimiter({ maxRequests: 120, window: MINUTE_MS })

/** Creating a cast reserves a row and a slug, so a handful a minute is already generous. */
export const createCastLimiter = new MemoryRateLimiter({ maxRequests: 5, window: MINUTE_MS })

/**
 * How many live feeds one client may hold, and how many the process accepts at once. The per-client
 * number is above what a browser can even open for one origin, so it only ever catches a script.
 */
const MAX_FEEDS_PER_CLIENT = 64
const MAX_FEEDS = 512

const feedsPerClient = new Map<string, number>()
let openFeeds = 0

/**
 * Reserves one live feed, or returns null when this client — or the process — is already holding
 * as many as it may. State is in-process, like the event bus: this app is one instance by design.
 * The returned release is safe to call more than once.
 */
export const openFeed = (key: string): (() => void) | null => {
  const held = feedsPerClient.get(key) ?? 0
  if (openFeeds >= MAX_FEEDS || held >= MAX_FEEDS_PER_CLIENT) {
    return null
  }

  feedsPerClient.set(key, held + 1)
  openFeeds += 1

  let released = false

  return () => {
    if (released) {
      return
    }

    released = true
    const remaining = (feedsPerClient.get(key) ?? 1) - 1
    if (remaining > 0) {
      feedsPerClient.set(key, remaining)
    } else {
      feedsPerClient.delete(key)
    }
    openFeeds -= 1
  }
}
