import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGitHub } from '../context/GitHubContext'
import GitHubProvider from '../context/GitHubProvider'
import { abortError, deferred, helloWorld, jsonResponse, octocat, repositoryOf } from '../test/github'
import type { Repository } from '../types/github'
import { useRepository } from './useRepository'

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

function signalOf(call: number): AbortSignal {
  return (fetchSpy.mock.calls[call][1] as RequestInit).signal as AbortSignal
}


describe('useRepository', () => {
  it('loads from the API: loading, then success with one request', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(helloWorld))
    const { result } = renderHook(() => useRepository('octocat', 'Hello-World'), { wrapper })

    expect(result.current.result).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current.result).toEqual({ status: 'success', repository: helloWorld }))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.github.com/repos/octocat/Hello-World')
  })

  it.each([
    ['not-found', jsonResponse({ message: 'Not Found' }, 404), { kind: 'not-found' }],
    ['unexpected', jsonResponse({ message: 'Server Error' }, 500), { kind: 'unexpected', status: 500 }],
  ])('maps a %s failure to its domain error', async (_kind, response, error) => {
    fetchSpy.mockResolvedValue(response)
    const { result } = renderHook(() => useRepository('octocat', 'Hello-World'), { wrapper })

    await waitFor(() => expect(result.current.result).toEqual({ status: 'error', error }))
  })

  it('maps a network failure to its domain error', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useRepository('octocat', 'Hello-World'), { wrapper })

    await waitFor(() =>
      expect(result.current.result).toEqual({ status: 'error', error: { kind: 'network' } }),
    )
  })

  it('maps an error outside the domain to unexpected', async () => {
    const response = jsonResponse(helloWorld)
    vi.spyOn(response, 'json').mockResolvedValue(null)
    fetchSpy.mockResolvedValue(response)
    const { result } = renderHook(() => useRepository('octocat', 'Hello-World'), { wrapper })

    await waitFor(() =>
      expect(result.current.result).toEqual({ status: 'error', error: { kind: 'unexpected' } }),
    )
  })

  it('aborts on change and discards the late answer', async () => {
    const a = deferred<Response>()
    const b = deferred<Response>()
    fetchSpy.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const repo = { current: 'repo-a' }
    const { result, rerender } = renderHook(() => useRepository('octocat', repo.current), { wrapper })

    repo.current = 'repo-b'
    rerender()

    expect(signalOf(0).aborted).toBe(true)
    expect(signalOf(1).aborted).toBe(false)
    // The stub ignores the abort, as a response already in flight would.
    await act(async () => a.resolve(jsonResponse(repositoryOf('repo-a'))))
    expect(result.current.result).toEqual({ status: 'loading' })

    await act(async () => b.resolve(jsonResponse(repositoryOf('repo-b'))))
    expect(result.current.result).toMatchObject({ status: 'success', repository: { name: 'repo-b' } })
  })

  it('aborts on unmount without reporting an error', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const pending = deferred<Response>()
    fetchSpy.mockReturnValue(pending.promise)
    const { unmount } = renderHook(() => useRepository('octocat', 'Hello-World'), { wrapper })

    unmount()

    expect(signalOf(0).aborted).toBe(true)
    await act(async () => pending.reject(abortError()))
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('retry goes back to loading and requests again only when called', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(jsonResponse(helloWorld))
    const { result } = renderHook(() => useRepository('octocat', 'Hello-World'), { wrapper })
    await waitFor(() => expect(result.current.result).toEqual({ status: 'error', error: { kind: 'network' } }))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    act(() => result.current.retry())

    expect(result.current.result).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current.result).toEqual({ status: 'success', repository: helloWorld }))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  describe('session cache', () => {
    /** Renders the hook after the session cached `octocat`'s profile and, if given, repositories. */
    function renderCached(repoName: { current: string }, repositories?: Repository[]) {
      const view = renderHook(
        () => ({ detail: useRepository('OctoCat', repoName.current), github: useGitHub() }),
        { wrapper },
      )
      act(() => {
        const { dispatch } = view.result.current.github
        dispatch({ type: 'profile/requested', key: 'octocat' })
        dispatch({ type: 'profile/loaded', key: 'octocat', profile: octocat })
        if (repositories) {
          dispatch({ type: 'repos/requested', key: 'octocat' })
          dispatch({ type: 'repos/loaded', key: 'octocat', repositories })
        }
      })
      return view
    }

    // The hook mounts on another repository first, so the cache is filled before the switch.
    it.each(['Hello-World', 'hello-world', 'HELLO-WORLD'])(
      'cache hit: %s in the cached list is served without a request',
      (name) => {
        const repoName = { current: 'repo-a' }
        fetchSpy.mockReturnValue(deferred<Response>().promise)
        const { result, rerender } = renderCached(repoName, [repositoryOf('other'), helloWorld])
        expect(fetchSpy).toHaveBeenCalledTimes(1)

        repoName.current = name
        rerender()

        expect(result.current.detail.result).toEqual({ status: 'success', repository: helloWorld })
        expect(fetchSpy).toHaveBeenCalledTimes(1)
      },
    )

    it('cache miss: a repository missing from the cached list is requested', async () => {
      // A fresh response per call: the first one, for hello-world, is made before the cache fills.
      fetchSpy.mockImplementation(async () => jsonResponse(repositoryOf('elsewhere')))
      const repoName = { current: 'hello-world' }
      const { result, rerender } = renderCached(repoName, [helloWorld])
      const before = fetchSpy.mock.calls.length

      repoName.current = 'elsewhere'
      rerender()

      expect(result.current.detail.result).toEqual({ status: 'loading' })
      expect(fetchSpy.mock.calls.length).toBe(before + 1)
      expect(fetchSpy.mock.lastCall?.[0]).toBe('https://api.github.com/repos/OctoCat/elsewhere')
      await waitFor(() =>
        expect(result.current.detail.result).toMatchObject({ status: 'success', repository: { name: 'elsewhere' } }),
      )
    })

    it('cache miss: a cached profile without repositories is requested', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(helloWorld))
      const { result } = renderCached({ current: 'Hello-World' })

      await waitFor(() => expect(result.current.detail.result).toEqual({ status: 'success', repository: helloWorld }))
      expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual(['https://api.github.com/repos/OctoCat/Hello-World'])
    })
  })
})
