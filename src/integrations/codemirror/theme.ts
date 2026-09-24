import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'
import type { ResolvedTheme } from '@/lib/theme'

/**
 * The GitHub themes carry both the editor chrome and the syntax colours, so they are swapped
 * through a compartment when the app theme changes — that also flips CodeMirror's own `dark` flag.
 */
export const editorThemes: Record<ResolvedTheme, Extension> = {
  dark: githubDark,
  light: githubLight
}

/**
 * The GitHub themes leave sizing and typography to the host: the editor fills whatever box the
 * caller sizes, and the code font comes from the app's `--font-mono`.
 */
export const editorLayoutTheme = EditorView.theme({
  '&': {
    height: '100%'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-content': {
    padding: '0.7rem 0'
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontSize: '0.875rem',
    lineHeight: '1.6',
    overflow: 'auto'
  }
})
