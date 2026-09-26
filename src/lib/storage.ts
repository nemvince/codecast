const scratchFor = (slug: string, language: string, field: string) =>
  `codecast:scratch:${slug}:${language}:${field}`

/** Set when a cast is created here, so its editor can offer the link the first time it opens. */
export const markNewCast = (slug: string): void => {
  try {
    globalThis.localStorage.setItem('codecast:new-cast', slug)
  } catch {
    // Private browsing or a full quota: losing this is survivable, a crash is not.
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
    // See markNewCast.
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
    // See markNewCast.
  }
}
