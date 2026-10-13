import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GitHubProvider from '../context/GitHubProvider'
import { abortError, deferred, jsonResponse, octocat, profileOf } from '../test/github'
import { useProfile } from './useProfile'

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

/** Two logins sharing one provider, so the cache survives switching between them. */
function useTwo(logins: { current: string }) {
  return useProfile(logins.current)
}

describe('useProfile', () => {
  it('loads an uncached login: loading, then success', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(octocat))
    const { result } = renderHook(() => useProfile('octocat'), { wrapper })

    expect(result.current.result).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current.result).toEqual({ status: 'success', profile: octocat }))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('cache hit: a login loaded before (any case) is served without a request', async () => {
    fetchSpy.mockImplementation(async (url: string) =>
      jsonResponse(url.endsWith('/octocat') ? octocat : profileOf('other')),
    )
    const logins = { current: 'OctoCat' }
    const { result, rerender } = renderHook(() => useTwo(logins), { wrapper })
    await waitFor(() => expect(result.current.result.status).toBe('success'))

    logins.current = 'other'
    rerender()
    await waitFor(() => expect(result.current.result).toMatchObject({ profile: { login: 'other' } }))
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    logins.current = 'octocat'
    rerender()
    expect(result.current.result).toEqual({ status: 'success', profile: octocat })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('maps a failure to its domain error', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'Not Found' }, 404))
    const { result } = renderHook(() => useProfile('ghost'), { wrapper })

    await waitFor(() =>
      expect(result.current.result).toEqual({ status: 'error', error: { kind: 'not-found' } }),
    )
  })

  it('maps an error outside the domain to unexpected', async () => {
    const response = jsonResponse(octocat)
    vi.spyOn(response, 'json').mockResolvedValue(null)
    fetchSpy.mockResolvedValue(response)
    const { result } = renderHook(() => useProfile('octocat'), { wrapper })

    await waitFor(() =>
      expect(result.current.result).toEqual({ status: 'error', error: { kind: 'unexpected' } }),
    )
  })

  it('aborts on login change and discards the late answer', async () => {
    const a = deferred<Response>()
    const b = deferred<Response>()
    fetchSpy.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const logins = { current: 'a' }
    const { result, rerender } = renderHook(() => useTwo(logins), { wrapper })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    logins.current = 'b'
    rerender()

    expect(signalOf(0).aborted).toBe(true)
    expect(signalOf(1).aborted).toBe(false)
    await act(async () => a.resolve(jsonResponse(profileOf('a'))))
    expect(result.current.result).toEqual({ status: 'loading' })

    await act(async () => b.resolve(jsonResponse(profileOf('b'))))
    expect(result.current.result).toMatchObject({ status: 'success', profile: { login: 'b' } })
  })

  it('aborts on unmount without reporting an error', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const pending = deferred<Response>()
    fetchSpy.mockReturnValue(pending.promise)
    const { unmount } = renderHook(() => useProfile('octocat'), { wrapper })

    unmount()

    expect(signalOf(0).aborted).toBe(true)
    await act(async () => pending.reject(abortError()))
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('retry requests again only when called', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(jsonResponse(octocat))
    const { result } = renderHook(() => useProfile('octocat'), { wrapper })
    await waitFor(() => expect(result.current.result).toEqual({ status: 'error', error: { kind: 'network' } }))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    act(() => result.current.retry())

    expect(result.current.result).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current.result).toEqual({ status: 'success', profile: octocat }))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
