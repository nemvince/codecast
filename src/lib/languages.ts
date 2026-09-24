export interface LanguageDefinition {
  /** Piston language name, as returned by GET /api/v2/runtimes. */
  id: string
  /** Shown in the language picker. */
  label: string
  /** Piston package to install, as listed by GET /api/v2/packages. */
  package: string
  /** Name of the file sent to Piston. */
  file: string
  /** Code a new cast or a fresh draft starts from. */
  starter: string
}

/**
 * The `file` name is not cosmetic: Piston writes this name verbatim and then the
 * language runtime script either appends an extension itself (java, go, gcc,
 * typescript) or feeds the name straight to the interpreter (node, python, rust).
 * Give an extension only where the runtime does not add one.
 */
export const LANGUAGES: readonly LanguageDefinition[] = [
  {
    file: 'main.py',
    id: 'python',
    label: 'Python',
    package: 'python',
    starter: `def greet(name):
    return f"Hello, {name}!"


names = ["Ada", "Grace", "Alan"]

for name in names:
    print(greet(name))
`
  },
  {
    file: 'main.js',
    id: 'javascript',
    label: 'JavaScript',
    package: 'node',
    starter: `function greet(name) {
  return \`Hello, \${name}!\`
}

const names = ['Ada', 'Grace', 'Alan']

for (const name of names) {
  console.log(greet(name))
}
`
  },
  {
    file: 'main',
    id: 'typescript',
    label: 'TypeScript',
    package: 'typescript',
    starter: `function greet(name: string): string {
  return \`Hello, \${name}!\`
}

const names: string[] = ['Ada', 'Grace', 'Alan']

for (const name of names) {
  console.log(greet(name))
}
`
  },
  {
    file: 'main',
    id: 'c',
    label: 'C',
    package: 'gcc',
    starter: `#include <stdio.h>

int main(void) {
  printf("Hello, class!\\n");
  return 0;
}
`
  },
  {
    file: 'main',
    id: 'c++',
    label: 'C++',
    package: 'gcc',
    starter: `#include <iostream>

int main() {
  std::cout << "Hello, class!" << std::endl;
  return 0;
}
`
  },
  {
    file: 'Main',
    id: 'java',
    label: 'Java',
    package: 'java',
    starter: `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello, class!");
  }
}
`
  },
  {
    file: 'main',
    id: 'go',
    label: 'Go',
    package: 'go',
    starter: `package main

import "fmt"

func main() {
  fmt.Println("Hello, class!")
}
`
  },
  {
    file: 'main.rs',
    id: 'rust',
    label: 'Rust',
    package: 'rust',
    starter: `fn main() {
    println!("Hello, class!");
}
`
  }
]

export const findLanguage = (id: string): LanguageDefinition | undefined =>
  LANGUAGES.find((language) => language.id === id)

/** Piston versions look like `3.12.0` or `1.21`; segment-wise numeric order, missing segments as 0. */
export const compareLanguageVersions = (left: string, right: string): number => {
  const leftSegments = left.split('.')
  const rightSegments = right.split('.')
  const segmentCount = Math.max(leftSegments.length, rightSegments.length)

  for (let index = 0; index < segmentCount; index += 1) {
    const difference = segmentOf(leftSegments[index]) - segmentOf(rightSegments[index])
    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

const segmentOf = (segment: string | undefined): number => {
  const value = Number.parseInt(segment ?? '0', 10)

  return Number.isNaN(value) ? 0 : value
}
