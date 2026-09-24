import type { Extension } from '@codemirror/state'
import { cpp } from '@codemirror/lang-cpp'
import { go } from '@codemirror/lang-go'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'

export const languageExtension = (id: string): Extension => {
  switch (id) {
    case 'c':
    case 'c++': {
      return cpp()
    }
    case 'go': {
      return go()
    }
    case 'java': {
      return java()
    }
    case 'javascript': {
      return javascript()
    }
    case 'python': {
      return python()
    }
    case 'rust': {
      return rust()
    }
    case 'typescript': {
      // Piston's typescript runtime compiles via tsc, so plain TS highlighting is an exact match.
      return javascript({ typescript: true })
    }
    default: {
      return []
    }
  }
}
