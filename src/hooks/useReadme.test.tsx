import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GitHubProvider from '../context/GitHubProvider'
import { abortError, deferred, htmlResponse, jsonResponse } from '../test/github'
import { useReadme } from './useReadme'

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const wrapper = ({ children }: { children: ReactNode }) => <GitHubProvider>{children}</GitHubProvider>

const signalOf = (call: number) => (fetchSpy.mock.calls[call][1] as RequestInit).signal as AbortSignal

interface Props {
  repo: string
  enabled: boolean
}

function renderReadme(initial: Props) {
  return renderHook(({ repo, enabled }: Props) => useReadme('octocat', repo, enabled), {
    wrapper,
    initialProps: initial,
  })
}

describe('useReadme', () => {
  it('idle and silent until enabled, then one request', async () => {
    fetchSpy.mockResolvedValue(htmlResponse('<p>A</p>'))
    const { result, rerender } = renderReadme({ repo: 'a', enabled: false })

    expect(result.current.result).toEqual({ status: 'idle' })
    expect(fetchSpy).not.toHaveBeenCalled()

    rerender({ repo: 'a', enabled: true })
    expect(result.current.result).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current.result).toEqual({ status: 'success', html: '<p>A</p>' }))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('404 is absent, not an error', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'Not Found' }, 404))
    const { result } = renderReadme({ repo: 'bare', enabled: true })

    await waitFor(() => expect(result.current.result).toEqual({ status: 'absent' }))
  })

  it.each([
    ['200', () => htmlResponse('<p>A</p>'), { status: 'success', html: '<p>A</p>' }],
    ['404', () => jsonResponse({ message: 'Not Found' }, 404), { status: 'absent' }],
  ] as const)('cache: a %s answer is served again, in any case, without a request', async (_status, answer, expected) => {
    fetchSpy.mockImplementation(async () => answer())
    const { result, rerender } = renderReadme({ repo: 'Hello-World', enabled: true })
    await waitFor(() => expect(result.current.result).toEqual(expected))

    rerender({ repo: 'other', enabled: true })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    rerender({ repo: 'HELLO-world', enabled: true })

    expect(result.current.result).toEqual(expected)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('abort: a repository change aborts the README in flight and drops its late answer', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    fetchSpy.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderReadme({ repo: 'a', enabled: true })

    rerender({ repo: 'b', enabled: true })
    expect(signalOf(0).aborted).toBe(true)
    expect(signalOf(1).aborted).toBe(false)

    // The first answer arrives anyway, then the second.
    await act(async () => first.resolve(htmlResponse('<p>late A</p>')))
    expect(result.current.result).toEqual({ status: 'loading' })
    await act(async () => second.resolve(htmlResponse('<p>B</p>')))
    expect(result.current.result).toEqual({ status: 'success', html: '<p>B</p>' })
  })

  it('abort: unmount aborts the README in flight, without an error', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const pending = deferred<Response>()
    fetchSpy.mockReturnValue(pending.promise)
    const { unmount } = renderReadme({ repo: 'a', enabled: true })

    unmount()
    expect(signalOf(0).aborted).toBe(true)
    await act(async () => pending.reject(abortError()))
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['network', () => Promise.reject(new TypeError('Failed to fetch'))],
    [
      'rate-limited',
      async () =>
        jsonResponse({ message: 'API rate limit exceeded' }, 403, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
        }),
    ],
    ['unexpected', async () => jsonResponse({ message: 'Server Error' }, 500)],
  ])('no automatic retry after a %s failure; retry asks exactly once more', async (kind, fail) => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetchSpy.mockImplementation(fail)
    const { result } = renderReadme({ repo: 'a', enabled: true })

    await waitFor(() => expect(result.current.result.status).toBe('error'))
    expect(result.current.result).toMatchObject({ status: 'error', error: { kind } })
    await act(async () => vi.advanceTimersByTime(60 * 60 * 1000))
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fetchSpy.mockResolvedValue(htmlResponse('<p>A</p>'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.result).toEqual({ status: 'success', html: '<p>A</p>' }))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
