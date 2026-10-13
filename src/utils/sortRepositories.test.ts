import { describe, expect, it } from 'vitest'
import { repositoryOf } from '../test/github'
import type { Repository } from '../types/github'
import { sortRepositories } from './sortRepositories'

const names = (repositories: Repository[]) => repositories.map((repository) => repository.name)

const stars = [
  repositoryOf('beta', { stargazers_count: 5 }),
  repositoryOf('alpha', { stargazers_count: 5 }),
  repositoryOf('gamma', { stargazers_count: 50 }),
  repositoryOf('delta', { stargazers_count: 0 }),
]

describe('sortRepositories', () => {
  it('stars-desc: most stars first, ties by name A–Z', () => {
    expect(names(sortRepositories(stars, 'stars-desc'))).toEqual(['gamma', 'alpha', 'beta', 'delta'])
  })

  it('stars-asc: fewest stars first, ties by name A–Z', () => {
    expect(names(sortRepositories(stars, 'stars-asc'))).toEqual(['delta', 'alpha', 'beta', 'gamma'])
  })

  it('name-asc: A–Z in pt-BR, ignoring case and accents', () => {
    const list = [
      repositoryOf('zeta'),
      repositoryOf('Ábaco'),
      repositoryOf('beta'),
      repositoryOf('acorde'),
      repositoryOf('Ação'),
    ]
    expect(names(sortRepositories(list, 'name-asc'))).toEqual(['Ábaco', 'Ação', 'acorde', 'beta', 'zeta'])
  })

  it('updated-desc: most recently updated first, ties by name A–Z', () => {
    const list = [
      repositoryOf('old', { updated_at: '2020-01-01T00:00:00Z' }),
      repositoryOf('tie-b', { updated_at: '2026-10-01T12:00:00Z' }),
      repositoryOf('newest', { updated_at: '2026-10-12T09:00:00Z' }),
      repositoryOf('tie-a', { updated_at: '2026-10-01T12:00:00Z' }),
    ]
    expect(names(sortRepositories(list, 'updated-desc'))).toEqual(['newest', 'tie-a', 'tie-b', 'old'])
  })

  it('names equal under base sensitivity keep their arrival order', () => {
    const list = [repositoryOf('Api', { stargazers_count: 1 }), repositoryOf('api', { stargazers_count: 1 })]
    expect(names(sortRepositories(list, 'name-asc'))).toEqual(['Api', 'api'])
    expect(names(sortRepositories(list, 'stars-desc'))).toEqual(['Api', 'api'])
    expect(names(sortRepositories([...list].reverse(), 'name-asc'))).toEqual(['api', 'Api'])
  })

  it('is pure: returns a new array and leaves a frozen input untouched', () => {
    const input = Object.freeze([...stars])
    const before = names([...input])

    const sorted = sortRepositories(input, 'stars-desc')

    expect(sorted).not.toBe(input)
    expect(names([...input])).toEqual(before)
    expect(sorted).toHaveLength(input.length)
  })
})

// PRD §15: one ordering rule. No other source sorts anything.
const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!**/*.test.{ts,tsx}', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('ordering rule', () => {
  it('sortRepositories is the only sorting rule in the project', () => {
    expect(Object.keys(sources)).toContain('./sortRepositories.ts')
    const offenders = Object.entries(sources)
      .filter(([path, source]) => path !== './sortRepositories.ts' && /\.(?:sort|toSorted)\s*\(/.test(source))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })
})
