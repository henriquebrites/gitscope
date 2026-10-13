import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GitHubProvider from '../context/GitHubProvider'
import {
  abortError,
  deferred,
  githubFetch,
  isRepositoriesUrl,
  jsonResponse,
  pageOf,
  repositoriesOf,
  repositoriesPage,
} from '../test/github'
import { useProfile } from './useProfile'
import { useRepositories } from './useRepositories'

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const wrapper = ({ children }: { children: ReactNode }) => <GitHubProvider>{children}</GitHubProvider>

const repoCalls = () => fetchSpy.mock.calls.filter(([url]) => isRepositoriesUrl(url as string))
const signalOf = (call: [unknown, RequestInit]) => call[1].signal as AbortSignal

/** The page's composition: repositories follow the profile of the same login. */
function useUserPage(logins: { current: string }) {
  const profile = useProfile(logins.current)
  const repositories = useRepositories(logins.current, profile.result.status === 'success')
  return { profile: profile.result, ...repositories }
}

describe('useRepositories', () => {
  it('disabled: idle and no request while the profile is not loaded', async () => {
    fetchSpy.mockImplementation(githubFetch())
    const { result } = renderHook(() => useRepositories('octocat', false), { wrapper })

    expect(result.current.result).toEqual({ status: 'idle' })
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('loads after the profile: loading with the page in progress, then success', async () => {
    const second = deferred<Response>()
    fetchSpy.mockImplementation(async (url: string) => {
      if (!isRepositoriesUrl(url)) return githubFetch()(url)
      return pageOf(url) === 1
        ? repositoriesPage(repositoriesOf('a', 100), 1, 2)
        : second.promise
    })
    const { result } = renderHook(() => useUserPage({ current: 'octocat' }), { wrapper })

    await waitFor(() => expect(result.current.result).toEqual({ status: 'loading', page: 2 }))
    await act(async () => second.resolve(repositoriesPage(repositoriesOf('b', 5), 2, 2)))

    expect(result.current.result).toMatchObject({ status: 'success' })
    expect(result.current.result.status === 'success' && result.current.result.repositories).toHaveLength(105)
  })

  it('maps a failure to its domain error', async () => {
    fetchSpy.mockImplementation(async (url: string) =>
      isRepositoriesUrl(url) ? jsonResponse({ message: 'Server Error' }, 500) : githubFetch()(url),
    )
    const { result } = renderHook(() => useUserPage({ current: 'octocat' }), { wrapper })

    await waitFor(() =>
      expect(result.current.result).toEqual({ status: 'error', error: { kind: 'unexpected', status: 500 } }),
    )
  })

  it('maps an error outside the domain to unexpected', async () => {
    // A null entry makes the normalisation throw a TypeError, not a GitHubApiError.
    fetchSpy.mockImplementation(async (url: string) =>
      isRepositoriesUrl(url) ? jsonResponse([null]) : githubFetch()(url),
    )
    const { result } = renderHook(() => useUserPage({ current: 'octocat' }), { wrapper })

    await waitFor(() =>
      expect(result.current.result).toEqual({ status: 'error', error: { kind: 'unexpected' } }),
    )
  })

  it('cache hit: repositories loaded before are served without a request', async () => {
    fetchSpy.mockImplementation(githubFetch({ octocat: repositoriesOf('a', 3) }))
    const logins = { current: 'octocat' }
    const { result, rerender } = renderHook(() => useUserPage(logins), { wrapper })
    await waitFor(() => expect(result.current.result.status).toBe('success'))
    logins.current = 'other'
    rerender()
    await waitFor(() => expect(result.current.result).toEqual({ status: 'success', repositories: [] }))
    expect(repoCalls()).toHaveLength(2)

    logins.current = 'OctoCat'
    rerender()

    expect(result.current.result).toMatchObject({ status: 'success', repositories: { length: 3 } })
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(repoCalls()).toHaveLength(2)
  })

  it('aborts on login change and discards the late pages', async () => {
    const pendingA = deferred<Response>()
    const reposOfB = repositoriesOf('b', 2)
    fetchSpy.mockImplementation(async (url: string) => {
      if (isRepositoriesUrl(url) && url.includes('/users/a/')) return pendingA.promise
      return githubFetch({ b: reposOfB })(url)
    })
    const logins = { current: 'a' }
    const { result, rerender } = renderHook(() => useUserPage(logins), { wrapper })
    await waitFor(() => expect(repoCalls()).toHaveLength(1))

    logins.current = 'b'
    rerender()

    expect(signalOf(repoCalls()[0] as [unknown, RequestInit]).aborted).toBe(true)
    await act(async () => pendingA.resolve(repositoriesPage(repositoriesOf('a', 100), 1, 2)))
    await waitFor(() => expect(result.current.result).toEqual({ status: 'success', repositories: reposOfB }))
    // No page 2 for the abandoned login.
    expect(repoCalls().map(([url]) => url)).toEqual([
      'https://api.github.com/users/a/repos?per_page=100&page=1',
      'https://api.github.com/users/b/repos?per_page=100&page=1',
    ])
  })

  it('aborts on unmount without reporting an error', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const pending = deferred<Response>()
    fetchSpy.mockImplementation(async (url: string) =>
      isRepositoriesUrl(url) ? pending.promise : githubFetch()(url),
    )
    const { unmount } = renderHook(() => useUserPage({ current: 'octocat' }), { wrapper })
    await waitFor(() => expect(repoCalls()).toHaveLength(1))

    unmount()

    expect(signalOf(repoCalls()[0] as [unknown, RequestInit]).aborted).toBe(true)
    await act(async () => pending.reject(abortError()))
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('retry restarts at page 1 only when called', async () => {
    let failSecond = true
    fetchSpy.mockImplementation(async (url: string) => {
      if (isRepositoriesUrl(url) && pageOf(url) === 2 && failSecond) {
        failSecond = false
        throw new TypeError('Failed to fetch')
      }
      return githubFetch({ octocat: repositoriesOf('a', 150) })(url)
    })
    const { result } = renderHook(() => useUserPage({ current: 'octocat' }), { wrapper })
    await waitFor(() => expect(result.current.result).toEqual({ status: 'error', error: { kind: 'network' } }))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(repoCalls()).toHaveLength(2)

    act(() => result.current.retry())

    expect(result.current.result).toEqual({ status: 'loading', page: 1 })
    await waitFor(() => expect(result.current.result).toMatchObject({ status: 'success' }))
    expect(repoCalls().map(([url]) => pageOf(url as string))).toEqual([1, 2, 1, 2])
    expect(fetchSpy.mock.calls.filter(([url]) => !isRepositoriesUrl(url as string))).toHaveLength(1)
  })
})
