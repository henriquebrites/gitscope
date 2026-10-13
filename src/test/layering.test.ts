import { describe, expect, it } from 'vitest'

// Key decision 1: only the service layer knows URLs, fetch and HTTP status codes.
const sources = import.meta.glob<string>(
  ['../components/**/*.{ts,tsx}', '../pages/**/*.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
)

const forbidden: [string, RegExp][] = [
  ['fetch call', /\bfetch\s*\(/],
  ['API URL', /api\.github\.com/],
  ['Response', /\bResponse\b/],
  ['response.ok', /\.ok\b/],
  ['HTTP status code', /(?<![\w.-])[1-5]\d{2}(?![\w.-])/],
  ['value import from services', /^import\s+(?!type\b)[^\n]*from\s+'[^']*\/services\//m],
]

describe('layering', () => {
  it('scans the presentation sources', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([
        '../components/profile/ProfileCard.tsx',
        '../components/profile/ProfileError.tsx',
        '../components/profile/ProfileSection.tsx',
        '../components/repositories/RepositoryError.tsx',
        '../components/repositories/RepositoryItem.tsx',
        '../components/repositories/RepositoryPager.tsx',
        '../components/repositories/RepositorySection.tsx',
        '../components/repositories/RepositorySort.tsx',
        '../pages/UserPage.tsx',
      ]),
    )
  })

  it.each(forbidden)('no presentation file contains a %s', (_name, pattern) => {
    const offenders = Object.entries(sources)
      .filter(([, source]) => pattern.test(source))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })
})
