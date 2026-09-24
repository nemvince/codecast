import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef } from 'react'
import { languageExtension } from '@/integrations/codemirror/languages'
import { editorLayoutTheme, editorThemes } from '@/integrations/codemirror/theme'
import { type ResolvedTheme, useResolvedTheme } from '@/lib/theme'

const READ_ONLY_EXTENSIONS: Extension = [
  EditorState.readOnly.of(true),
  EditorView.editable.of(false)
]

interface CodeEditorProps {
  value: string
  language: string
  readOnly?: boolean
  onChange?: (value: string) => void
  onRun?: () => void
  className?: string
  'aria-label'?: string
}

interface EditorHandle {
  view: EditorView
  languageCompartment: Compartment
  languageId: string
  readOnlyCompartment: Compartment
  readOnlyState: boolean
  theme: ResolvedTheme
  themeCompartment: Compartment
}

interface EditorStateOptions {
  value: string
  language: string
  readOnly: boolean
  theme: ResolvedTheme
  ariaLabel?: string
  onChange: (value: string) => void
  onRun: () => void
}

/** Compartments are created here so the effects below can reconfigure them afterwards. */
const createEditorState = ({
  value,
  language,
  readOnly,
  theme,
  ariaLabel,
  onChange,
  onRun
}: EditorStateOptions) => {
  const languageCompartment = new Compartment()
  const readOnlyCompartment = new Compartment()
  const themeCompartment = new Compartment()
  // Prec.high: basicSetup's default keymap binds plain Enter, and it must not win Mod-Enter.
  const runKeymap = Prec.high(
    keymap.of([
      {
        key: 'Mod-Enter',
        run: () => {
          onRun()

          return true
        }
      }
    ])
  )
  const notifyChange = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString())
    }
  })
  const extensions: Extension[] = [
    basicSetup,
    languageCompartment.of(languageExtension(language)),
    readOnlyCompartment.of(readOnly ? READ_ONLY_EXTENSIONS : []),
    themeCompartment.of(editorThemes[theme]),
    editorLayoutTheme,
    EditorView.lineWrapping,
    runKeymap,
    notifyChange
  ]

  if (ariaLabel) {
    extensions.push(EditorView.contentAttributes.of({ 'aria-label': ariaLabel }))
  }

  return {
    languageCompartment,
    readOnlyCompartment,
    state: EditorState.create({ doc: value, extensions }),
    themeCompartment
  }
}

// oxlint-disable-next-line max-statements
export const CodeEditor = ({
  value,
  language,
  readOnly = false,
  onChange,
  onRun,
  className,
  'aria-label': ariaLabel
}: CodeEditorProps) => {
  const theme = useResolvedTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<EditorHandle | null>(null)
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)

  useEffect(() => {
    onChangeRef.current = onChange
    onRunRef.current = onRun
  })

  // The view is created after mount and destroyed on unmount.
  // CodeMirror must never touch the DOM while rendering, or server rendering breaks.
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const { languageCompartment, readOnlyCompartment, themeCompartment, state } = createEditorState(
      {
        ariaLabel,
        language,
        onChange: (next) => onChangeRef.current?.(next),
        onRun: () => onRunRef.current?.(),
        readOnly,
        theme,
        value
      }
    )
    const view = new EditorView({ parent: container, state })

    editorRef.current = {
      languageCompartment,
      languageId: language,
      readOnlyCompartment,
      readOnlyState: readOnly,
      theme,
      themeCompartment,
      view
    }

    return () => {
      view.destroy()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || editor.languageId === language) {
      return
    }

    editor.languageId = language
    editor.view.dispatch({
      effects: editor.languageCompartment.reconfigure(languageExtension(language))
    })
  }, [language])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || editor.readOnlyState === readOnly) {
      return
    }

    editor.readOnlyState = readOnly
    editor.view.dispatch({
      effects: editor.readOnlyCompartment.reconfigure(readOnly ? READ_ONLY_EXTENSIONS : [])
    })
  }, [readOnly])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || editor.theme === theme) {
      return
    }

    editor.theme = theme
    editor.view.dispatch({
      effects: editor.themeCompartment.reconfigure(editorThemes[theme])
    })
  }, [theme])

  // The equality guard keeps controlled usage loop-free.
  // A keystroke echoes back as an equal value, and resetting the document would move the cursor.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const current = editor.view.state.doc.toString()
    if (current !== value) {
      editor.view.dispatch({ changes: { from: 0, insert: value, to: current.length } })
    }
  }, [value])

  return <div className={className} ref={containerRef} />
}
