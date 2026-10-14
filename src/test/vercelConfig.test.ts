import { describe, expect, it } from 'vitest'
import raw from '../../vercel.json?raw'

// Vercel serves static files first and 404s any other path unless it is rewritten to the SPA shell.
const config = JSON.parse(raw) as Record<string, unknown>
const toRegExp = (source: string) => new RegExp(`^${source}$`)

describe('Vercel config', () => {
  it('rewrites every path to index.html', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
    expect(config).not.toHaveProperty('redirects')
    expect(config).not.toHaveProperty('routes')
    expect(config).not.toHaveProperty('headers')
  })

  it('matches deep links', () => {
    const [{ source }] = config.rewrites as { source: string }[]
    for (const path of ['/', '/users/octocat', '/users/octocat/repos/hello-world']) {
      expect(path).toMatch(toRegExp(source))
    }
  })
})
