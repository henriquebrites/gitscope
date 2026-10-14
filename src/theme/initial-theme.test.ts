import { afterEach, describe, expect, it, vi } from 'vitest'
import html from '../../index.html?raw'

// The classic (non-module) script in index.html runs before the first paint.
const inlineScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(([, code]) => code)

type Stored = 'light' | 'dark' | 'invalid' | 'absent' | 'throws'

function runWith(stored: Stored, systemIsDark: boolean): string | null {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => {
      if (stored === 'throws') throw new DOMException('Blocked', 'SecurityError')
      if (key !== 'github-explorer:theme' || stored === 'absent') return null
      return stored === 'invalid' ? 'system' : stored
    },
  })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && systemIsDark,
  }))
  document.documentElement.removeAttribute('data-theme')
  new Function(inlineScript[0])()
  return document.documentElement.getAttribute('data-theme')
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

describe('initial theme script (index.html)', () => {
  it('is one classic script in the head, before the app module', () => {
    expect(inlineScript).toHaveLength(1)
    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toContain(inlineScript[0])
    expect(html.indexOf(inlineScript[0])).toBeLessThan(html.indexOf('type="module"'))
  })

  it.each<[Stored, boolean, string]>([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['invalid', false, 'light'],
    ['invalid', true, 'dark'],
    ['absent', false, 'light'],
    ['absent', true, 'dark'],
    ['throws', false, 'light'],
    ['throws', true, 'dark'],
  ])('stored %s, system dark %s -> data-theme="%s"', (stored, systemIsDark, expected) => {
    expect(runWith(stored, systemIsDark)).toBe(expected)
  })
})
