import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  abortError,
  deferred,
  helloWorld,
  jsonResponse,
  octocat,
  repositoriesOf,
  repositoriesPage,
  repositoryOf,
} from '../test/github'
import type { Profile, Repository } from '../types/github'
import { getReadme, getRepositories, getRepository, getUser, GitHubApiError, type GitHubError } from './githubApi'

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

  describe('maps secondary rate limit', () => {
    const now = new Date(2026, 9, 13, 14, 0)

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(now)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it.each([
      [403, { 'retry-after': '60' }],
      [429, { 'retry-after': '60' }],
      [403, { 'retry-after': '60', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791900300' }],
    ])('waits retry-after (%i, %o)', async (status, headers) => {
      fetchSpy.mockResolvedValue(jsonResponse({ message: 'secondary rate limit' }, status, headers))

      expect(await failureOf(getUser('octocat'))).toEqual({
        kind: 'rate-limited',
        resetAt: new Date(now.getTime() + 60_000),
      })
    })

    it('without a numeric retry-after shows no time', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ message: 'secondary rate limit' }, 403, { 'retry-after': 'soon' }))

      const error = await failureOf(getUser('octocat'))

      expect(error).toEqual({ kind: 'rate-limited' })
      expect(error).not.toHaveProperty('resetAt')
    })
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

  // Either sign of an abort is enough on its own: the aborted signal, or an AbortError.
  it('abort is recognised by the aborted signal alone', async () => {
    const controller = new AbortController()
    controller.abort()
    const failure = new Error('request torn down')
    fetchSpy.mockRejectedValue(failure)

    const reason = await getUser('octocat', controller.signal).then(
      () => null,
      (error: unknown) => error,
    )

    expect(reason).toBe(failure)
  })

  it('abort is recognised by an AbortError alone', async () => {
    const aborted = abortError()
    fetchSpy.mockRejectedValue(aborted)

    const reason = await getUser('octocat', new AbortController().signal).then(
      () => null,
      (error: unknown) => error,
    )

    expect(reason).toBe(aborted)
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

const reposUrl = (page: number) => `https://api.github.com/users/octocat/repos?per_page=100&page=${page}`
const requestedUrls = () => fetchSpy.mock.calls.map(([url]) => url as string)

describe('getRepositories', () => {
  it('fetches every page while rel="next" is present', async () => {
    const pages = [repositoriesOf('a', 100), repositoriesOf('b', 100), repositoriesOf('c', 37)]
    fetchSpy.mockImplementation(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page'))
      return repositoriesPage(pages[page - 1], page, 3)
    })

    const repositories = await getRepositories('octocat')

    expect(requestedUrls()).toEqual([reposUrl(1), reposUrl(2), reposUrl(3)])
    expect(repositories).toHaveLength(237)
    expect(repositories).toEqual(pages.flat())
    const headers = new Headers((fetchSpy.mock.calls[0][1] as RequestInit).headers)
    expect(headers.has('Authorization')).toBe(false)
  })

  it('requests one page at a time, each after the previous arrived', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    fetchSpy.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const pagesSeen: number[] = []

    const result = getRepositories('octocat', { onPage: (page) => pagesSeen.push(page) })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(pagesSeen).toEqual([1])

    first.resolve(repositoriesPage(repositoriesOf('a', 100), 1, 2))
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(pagesSeen).toEqual([1, 2])
    second.resolve(repositoriesPage(repositoriesOf('b', 3), 2, 2))

    expect(await result).toHaveLength(103)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['no link header', {}],
    ['only prev and first', { link: '<https://api.github.com/user/1/repos?page=1>; rel="prev", <https://api.github.com/user/1/repos?page=1>; rel="first"' }],
    ['only last', { link: '<https://api.github.com/user/1/repos?page=1>; rel="last"' }],
  ])('stops without rel=next (%s)', async (_case, headers: Record<string, string>) => {
    fetchSpy.mockResolvedValue(jsonResponse(repositoriesOf('a', 5), 200, headers))

    expect(await getRepositories('octocat')).toHaveLength(5)
    expect(requestedUrls()).toEqual([reposUrl(1)])
  })

  it('encodes the login in the path', async () => {
    fetchSpy.mockResolvedValue(jsonResponse([]))

    expect(await getRepositories('a b/c')).toEqual([])
    expect(requestedUrls()).toEqual(['https://api.github.com/users/a%20b%2Fc/repos?per_page=100&page=1'])
  })

  it('normalizes repositories to the PRD fields, missing description and language as null', async () => {
    const full = repositoryOf('full', { stargazers_count: 42 })
    const bare: Partial<Repository> = repositoryOf('bare')
    delete bare.description
    delete bare.language
    fetchSpy.mockResolvedValue(
      jsonResponse([{ ...full, owner: { login: 'octocat' }, forks: 3 }, bare]),
    )

    const repositories = await getRepositories('octocat')

    expect(repositories).toEqual([full, { ...bare, description: null, language: null }])
    expect(repositories[1]).not.toHaveProperty('owner')
    expect(repositories[0]).not.toHaveProperty('forks')
    expectTypeOf<Repository>().toEqualTypeOf<{
      id: number
      name: string
      full_name: string
      html_url: string
      description: string | null
      stargazers_count: number
      language: string | null
      updated_at: string
    }>()
  })

  it('maps a body that is not a list to unexpected', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'odd' }))

    expect(await failureOf(getRepositories('octocat'))).toEqual({ kind: 'unexpected', status: 200 })
  })

  it.each<[string, () => Promise<Response>, GitHubError]>([
    ['500', async () => jsonResponse({ message: 'Server Error' }, 500), { kind: 'unexpected', status: 500 }],
    ['network', async () => Promise.reject(new TypeError('Failed to fetch')), { kind: 'network' }],
    [
      'rate limit',
      async () =>
        jsonResponse({ message: 'API rate limit exceeded' }, 403, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1791900300',
        }),
      { kind: 'rate-limited', resetAt: new Date(1791900300 * 1000) },
    ],
  ])('a failing page rejects the whole list (page 2: %s)', async (_case, secondPage, expected) => {
    fetchSpy
      .mockResolvedValueOnce(repositoriesPage(repositoriesOf('a', 100), 1, 3))
      .mockImplementationOnce(secondPage)

    expect(await failureOf(getRepositories('octocat'))).toEqual(expected)
    expect(requestedUrls()).toEqual([reposUrl(1), reposUrl(2)])
  })

  it('abort between pages: rejects with the AbortError and requests no next page', async () => {
    const controller = new AbortController()
    const first = deferred<Response>()
    fetchSpy.mockReturnValueOnce(first.promise)

    const result = getRepositories('octocat', { signal: controller.signal }).then(
      () => null,
      (error: unknown) => error,
    )
    controller.abort()
    // The stub ignores the abort, as a response already in flight would.
    first.resolve(repositoriesPage(repositoriesOf('a', 100), 1, 3))
    const reason = await result

    expect(reason).toBe(controller.signal.reason)
    expect((reason as Error).name).toBe('AbortError')
    expect(requestedUrls()).toEqual([reposUrl(1)])
    expect((fetchSpy.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal)
  })
})

describe('getRepository', () => {
  it('getRepository requests one repository anonymously and returns the PRD fields', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...helloWorld, forks_count: 9, owner: { login: 'octocat' } }))

    const repository = await getRepository('octocat', 'Hello-World')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit | undefined]
    expect(url).toBe('https://api.github.com/repos/octocat/Hello-World')
    expect(init?.method ?? 'GET').toBe('GET')
    expect(new Headers(init?.headers).has('Authorization')).toBe(false)
    expect(repository).toEqual({
      id: 1296269,
      name: 'Hello-World',
      full_name: 'octocat/Hello-World',
      html_url: 'https://github.com/octocat/Hello-World',
      description: 'My first repository on GitHub!',
      stargazers_count: 12345,
      language: 'TypeScript',
      updated_at: '2026-10-01T12:00:00Z',
    })
  })

  it('getRepository encodes the owner and the repository name', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(helloWorld))

    await getRepository('a b', 'x/y')

    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.github.com/repos/a%20b/x%2Fy')
  })

  it.each([
    ['null', { description: null, language: null }],
    ['missing', { description: undefined, language: undefined }],
  ])('getRepository normalizes %s description and language to null', async (_case, fields) => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...helloWorld, ...fields }))

    const repository = await getRepository('octocat', 'Hello-World')

    expect(repository.description).toBeNull()
    expect(repository.language).toBeNull()
  })

  it('getRepository maps each failure to its domain error', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404))
    expect(await failureOf(getRepository('octocat', 'nope'))).toEqual({ kind: 'not-found' })

    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await failureOf(getRepository('octocat', 'Hello-World'))).toEqual({ kind: 'network' })

    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ message: 'API rate limit exceeded' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1791900300',
      }),
    )
    expect(await failureOf(getRepository('octocat', 'Hello-World'))).toEqual({
      kind: 'rate-limited',
      resetAt: new Date(1791900300 * 1000),
    })

    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: 'Server Error' }, 500))
    expect(await failureOf(getRepository('octocat', 'Hello-World'))).toEqual({
      kind: 'unexpected',
      status: 500,
    })
  })
})

describe('getReadme', () => {
  const htmlResponse = (body: string, status = 200, headers: Record<string, string> = {}) =>
    new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers } })

  it('getReadme requests the rendered HTML anonymously and returns it as text', async () => {
    fetchSpy.mockResolvedValue(htmlResponse('<h1>Hello</h1>'))

    const html = await getReadme('octocat', 'Hello-World')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit | undefined]
    expect(url).toBe('https://api.github.com/repos/octocat/Hello-World/readme')
    expect(init?.method ?? 'GET').toBe('GET')
    const headers = new Headers(init?.headers)
    expect(headers.get('Accept')).toBe('application/vnd.github.html+json')
    expect(headers.has('Authorization')).toBe(false)
    expect(html).toBe('<h1>Hello</h1>')
  })

  it('getReadme encodes the owner and the repository name', async () => {
    fetchSpy.mockResolvedValue(htmlResponse(''))

    await getReadme('a b', 'x/y')

    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.github.com/repos/a%20b/x%2Fy/readme')
  })

  it('getReadme: 404 means no README, not an error', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'Not Found' }, 404))

    expect(await getReadme('octocat', 'bare')).toBeNull()
  })

  it('getReadme maps each failure to its domain error', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await failureOf(getReadme('octocat', 'Hello-World'))).toEqual({ kind: 'network' })

    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ message: 'API rate limit exceeded' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1791900300',
      }),
    )
    expect(await failureOf(getReadme('octocat', 'Hello-World'))).toEqual({
      kind: 'rate-limited',
      resetAt: new Date(1791900300 * 1000),
    })

    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: 'Too Many' }, 429, { 'retry-after': '60' }))
    expect((await failureOf(getReadme('octocat', 'Hello-World'))).kind).toBe('rate-limited')

    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: 'Server Error' }, 500))
    expect(await failureOf(getReadme('octocat', 'Hello-World'))).toEqual({ kind: 'unexpected', status: 500 })
  })

  it('getReadme: an abort rejects with the AbortError, never a domain error', async () => {
    const controller = new AbortController()
    fetchSpy.mockImplementation(() => {
      controller.abort()
      return Promise.reject(abortError())
    })

    const error = await getReadme('octocat', 'Hello-World', controller.signal).catch((reason: unknown) => reason)

    expect(error).not.toBeInstanceOf(GitHubApiError)
    expect((error as DOMException).name).toBe('AbortError')
  })
})
