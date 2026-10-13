import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { abortError, jsonResponse, octocat } from '../test/github'
import type { Profile } from '../types/github'
import { getUser, GitHubApiError, type GitHubError } from './githubApi'

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function failureOf(promise: Promise<unknown>): Promise<GitHubError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(GitHubApiError)
  return (error as GitHubApiError).error
}

describe('getUser', () => {
  it('requests the user anonymously and returns the PRD fields', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...octocat, id: 583231, company: '@github' }))

    const profile = await getUser('octocat')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit | undefined]
    expect(url).toBe('https://api.github.com/users/octocat')
    expect(init?.method ?? 'GET').toBe('GET')
    const headers = new Headers(init?.headers)
    expect(headers.has('Authorization')).toBe(false)
    expect(profile).toEqual({
      login: 'octocat',
      name: 'The Octocat',
      avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
      html_url: 'https://github.com/octocat',
      bio: 'Mascote do GitHub.',
      email: 'octocat@github.com',
      followers: 12345,
      following: 7,
      public_repos: 8,
    })
  })

  it('types the profile with nullable name, bio and email', () => {
    expectTypeOf<Profile>().toEqualTypeOf<{
      login: string
      name: string | null
      avatar_url: string
      html_url: string
      bio: string | null
      email: string | null
      followers: number
      following: number
      public_repos: number
    }>()
  })

  it('encodes the login in the path', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(octocat))

    await getUser('a b/c')

    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.github.com/users/a%20b%2Fc')
  })

  it('passes the abort signal to fetch', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(octocat))
    const controller = new AbortController()

    await getUser('octocat', controller.signal)

    expect((fetchSpy.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal)
  })

  it('maps 404 to not-found', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'Not Found' }, 404))

    expect(await failureOf(getUser('ghost'))).toEqual({ kind: 'not-found' })
  })

  it.each([
    [403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791900300' }, new Date(1791900300 * 1000)],
    [403, { 'x-ratelimit-remaining': '0' }, undefined],
    [429, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791900300' }, new Date(1791900300 * 1000)],
    [429, { 'x-ratelimit-remaining': '0' }, undefined],
  ])('maps rate limit (%i, %o)', async (status, headers, resetAt) => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'API rate limit exceeded' }, status, headers))

    const error = await failureOf(getUser('octocat'))

    expect(error.kind).toBe('rate-limited')
    if (error.kind !== 'rate-limited') return
    if (resetAt) expect(error.resetAt?.getTime()).toBe(resetAt.getTime())
    else expect(error).not.toHaveProperty('resetAt')
  })

  it('maps a network failure to network', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))

    expect(await failureOf(getUser('octocat'))).toEqual({ kind: 'network' })
  })

  it('abort is not a domain error', async () => {
    const controller = new AbortController()
    controller.abort()
    const aborted = abortError()
    fetchSpy.mockRejectedValue(aborted)

    const reason = await getUser('octocat', controller.signal).then(
      () => null,
      (error: unknown) => error,
    )

    expect(reason).toBe(aborted)
    expect(reason).not.toBeInstanceOf(GitHubApiError)
  })

  it('maps an unreadable body to unexpected with its status', async () => {
    fetchSpy.mockResolvedValue(new Response('<html>not json</html>', { status: 200 }))

    expect(await failureOf(getUser('octocat'))).toEqual({ kind: 'unexpected', status: 200 })
  })

  it('abort while reading the body is not a domain error', async () => {
    const controller = new AbortController()
    const aborted = abortError()
    const response = jsonResponse(octocat)
    vi.spyOn(response, 'json').mockImplementation(async () => {
      controller.abort()
      throw aborted
    })
    fetchSpy.mockResolvedValue(response)

    const reason = await getUser('octocat', controller.signal).then(
      () => null,
      (error: unknown) => error,
    )

    expect(reason).toBe(aborted)
  })

  it.each([
    [500, {}],
    [403, { 'x-ratelimit-remaining': '12' }],
    [429, {}],
  ])('maps other failures to unexpected (%i, %o)', async (status, headers) => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'error' }, status, headers))

    expect(await failureOf(getUser('octocat'))).toEqual({ kind: 'unexpected', status })
  })
})
