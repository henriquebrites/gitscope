import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GitHubProvider from '../context/GitHubProvider'
import { abortError, deferred, helloWorld, jsonResponse } from '../test/github'
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

const repositoryOf = (name: string) => ({ ...helloWorld, name, full_name: `octocat/${name}` })

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
})
