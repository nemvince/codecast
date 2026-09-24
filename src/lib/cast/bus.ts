import { EventPublisher } from '@orpc/server'
import type { CastEvent, CastEventKind } from '@/orpc/schema'

/**
 * Server-only, and in-process: this app targets a single server instance, as a classroom needs.
 * Keyed by slug, so every viewer of one cast hears only that cast's changes.
 */
export const castEvents = new EventPublisher<Record<string, CastEvent>>()

export const publishCastEvent = (slug: string, kind: CastEventKind): void => {
  castEvents.publish(slug, { kind, slug })
}
