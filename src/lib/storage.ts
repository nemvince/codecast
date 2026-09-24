export interface RecentCast {
  slug: string
  createdAt: string
}

const RECENT_SESSIONS_LIMIT = 20

const editKeyFor = (slug: string) => `codecast:edit:${slug}`
const scratchFor = (slug: string, language: string, field: string) =>
  `codecast:scratch:${slug}:${language}:${field}`

export const readEditKey = (slug: string): string | null => {
  try {
    return globalThis.localStorage.getItem(editKeyFor(slug))
  } catch {
    return null
  }
}

export const writeEditKey = (slug: string, editKey: string): void => {
  try {
    globalThis.localStorage.setItem(editKeyFor(slug), editKey)
  } catch {
    // Private browsing or a full quota: losing the key is survivable, a crash is not.
  }
}

/** Set when a cast is created here, so its editor can offer the link the first time it opens. */
export const markNewCast = (slug: string): void => {
  try {
    globalThis.localStorage.setItem('codecast:new-cast', slug)
  } catch {
    // See writeEditKey.
  }
}

/** Reads and clears the marker: the link is offered once per created cast, not per page load. */
export const consumeNewCast = (slug: string): boolean => {
  try {
    if (globalThis.localStorage.getItem('codecast:new-cast') !== slug) {
      return false
    }

    globalThis.localStorage.removeItem('codecast:new-cast')

    return true
  } catch {
    return false
  }
}

export const readRecentCasts = (): RecentCast[] => {
  try {
    const raw = globalThis.localStorage.getItem('codecast:casts')
    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (entry): entry is RecentCast =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentCast).slug === 'string' &&
        typeof (entry as RecentCast).createdAt === 'string'
    )
  } catch {
    return []
  }
}

export const addRecentCast = (entry: RecentCast): void => {
  try {
    const kept = readRecentCasts().filter((cast) => cast.slug !== entry.slug)

    globalThis.localStorage.setItem(
      'codecast:casts',
      JSON.stringify([entry, ...kept].slice(0, RECENT_SESSIONS_LIMIT))
    )
  } catch {
    // See writeEditKey.
  }
}

export const readScratchLanguage = (slug: string): string | null => {
  try {
    return globalThis.localStorage.getItem(`codecast:scratch:${slug}:language`)
  } catch {
    return null
  }
}

export const writeScratchLanguage = (slug: string, language: string): void => {
  try {
    globalThis.localStorage.setItem(`codecast:scratch:${slug}:language`, language)
  } catch {
    // See writeEditKey.
  }
}

export const readScratch = (
  slug: string,
  language: string,
  field: 'code' | 'stdin'
): string | null => {
  try {
    return globalThis.localStorage.getItem(scratchFor(slug, language, field))
  } catch {
    return null
  }
}

export const writeScratch = (
  slug: string,
  language: string,
  entry: { field: 'code' | 'stdin'; value: string }
): void => {
  try {
    globalThis.localStorage.setItem(scratchFor(slug, language, entry.field), entry.value)
  } catch {
    // See writeEditKey.
  }
}
