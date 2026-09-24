import { useSyncExternalStore } from 'react'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'auto']

export const THEME_LABELS: Record<ThemeMode, string> = {
  auto: 'System',
  dark: 'Dark',
  light: 'Light'
}

const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'auto'

const readStoredMode = (): ThemeMode => {
  const stored = globalThis.localStorage.getItem(STORAGE_KEY)

  return isThemeMode(stored) ? stored : 'auto'
}

const resolveTheme = (mode: ThemeMode): ResolvedTheme => {
  if (mode === 'auto') {
    return globalThis.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  }

  return mode
}

/** Mirrors the inline head script in the root route, so React and the pre-hydration script agree. */
const applyThemeMode = (mode: ThemeMode) => {
  const root = document.documentElement
  const resolved = resolveTheme(mode)

  root.classList.remove('light', 'dark')
  root.classList.add(resolved)

  if (mode === 'auto') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }

  root.style.colorScheme = resolved
}

let mode: ThemeMode = typeof document === 'undefined' ? 'auto' : readStoredMode()
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

const emit = () => {
  for (const listener of listeners) {
    listener()
  }
}

export const setThemeMode = (next: ThemeMode) => {
  mode = next
  globalThis.localStorage.setItem(STORAGE_KEY, next)
  applyThemeMode(next)
  emit()
}

// Auto mode follows the system preference for as long as the page stays open.
if (typeof globalThis.matchMedia === 'function') {
  globalThis.matchMedia(DARK_QUERY).addEventListener('change', () => {
    applyThemeMode(mode)
    emit()
  })
}

/** The mode the visitor chose, which is what the toggle renders as selected. */
export const useThemeMode = () =>
  useSyncExternalStore(
    subscribe,
    () => mode,
    (): ThemeMode => 'auto'
  )

/** What is actually painted right now: `auto` resolved against the system preference. */
export const useResolvedTheme = () =>
  useSyncExternalStore(
    subscribe,
    () => resolveTheme(mode),
    (): ResolvedTheme => 'light'
  )
