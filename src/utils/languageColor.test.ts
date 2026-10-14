import { describe, expect, it } from 'vitest'
import { languageColor } from './languageColor'

describe('languageColor', () => {
  it.each([
    ['TypeScript', '#3178c6'],
    ['JavaScript', '#f1e05a'],
    ['Python', '#3572a5'],
    ['Shell', '#89e051'],
    ['C++', '#f34b7d'],
  ])('%s has its Linguist colour', (language, color) => {
    expect(languageColor(language)).toBe(color)
  })

  it.each(['Brainfuck', 'typescript', 'constructor', 'toString', ''])(
    'a language outside the map (%s) has none: the dot is neutral',
    (language) => {
      expect(languageColor(language)).toBeNull()
    },
  )
})
