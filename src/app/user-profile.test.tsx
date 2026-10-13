import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abortError, deferred, jsonResponse, octocat, profileOf } from '../test/github'
import { routes } from './routes'

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

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const main = () => screen.getByRole('main')
const profileArea = () => within(main()).getByRole('region', { name: 'Perfil' })
const requestedUrls = () => fetchSpy.mock.calls.map(([url]) => url as string)
const signalOf = (call: number) => (fetchSpy.mock.calls[call][1] as RequestInit).signal as AbortSignal

async function search(login: string) {
  const field = within(screen.getByRole('banner')).getByRole('textbox', {
    name: 'Nome de usuário do GitHub',
  })
  await userEvent.setup().type(field, `${login}{Enter}`)
}

describe('user profile route', () => {
  it('shows the profile from the API', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(octocat))
    renderAt('/users/octocat')

    expect(await within(main()).findByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
    expect(within(main()).getByRole('img', { name: 'Avatar de octocat' })).toBeVisible()
    expect(
      within(main()).getByRole('link', { name: 'Ver perfil no GitHub (abre em nova aba)' }),
    ).toHaveAttribute('href', 'https://github.com/octocat')
    expect(requestedUrls()).toEqual(['https://api.github.com/users/octocat'])
  })

  it('shows no previous user while loading the next one', async () => {
    const next = deferred<Response>()
    fetchSpy.mockResolvedValueOnce(jsonResponse(profileOf('alpha'))).mockReturnValueOnce(next.promise)
    renderAt('/users/alpha')
    await within(main()).findByRole('heading', { level: 1, name: 'alpha' })

    await search('beta')

    expect(within(profileArea()).getByTestId('profile-skeleton')).toBeInTheDocument()
    expect(main()).not.toHaveTextContent(/alpha/i)
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Buscando…' })).toBeDisabled()

    await act(async () => next.resolve(jsonResponse(profileOf('beta'))))
    expect(within(main()).getByRole('heading', { level: 1, name: 'beta' })).toBeVisible()
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Buscar' })).toBeEnabled()
  })

  it('aborts and discards the previous user', async () => {
    const a = deferred<Response>()
    const b = deferred<Response>()
    fetchSpy.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const router = renderAt('/users/a')

    await act(() => router.navigate('/users/b'))

    expect(signalOf(0).aborted).toBe(true)
    expect(signalOf(1).aborted).toBe(false)
    // The stub ignores the abort, as a response already in flight would.
    await act(async () => a.resolve(jsonResponse(profileOf('a', { name: 'Usuária A' }))))
    expect(main()).not.toHaveTextContent('Usuária A')
    await act(async () => b.resolve(jsonResponse(profileOf('b', { name: 'Usuária B' }))))
    expect(within(main()).getByRole('heading', { level: 1, name: 'b' })).toBeVisible()
    expect(main()).toHaveTextContent('Usuária B')
    expect(main()).not.toHaveTextContent('Usuária A')
  })

  it('aborts silently on leave', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const pending = deferred<Response>()
    fetchSpy.mockReturnValue(pending.promise)
    const router = renderAt('/users/octocat')

    await act(() => router.navigate('/'))

    expect(signalOf(0).aborted).toBe(true)
    await act(async () => pending.reject(abortError()))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Buscar' })).toBeEnabled()
  })

  it('serves a visited profile from the cache', async () => {
    fetchSpy.mockImplementation(async (url: string) =>
      jsonResponse(url.endsWith('/octocat') ? octocat : profileOf('other')),
    )
    renderAt('/users/OctoCat')
    await within(main()).findByRole('heading', { level: 1, name: 'octocat' })
    await search('other')
    await within(main()).findByRole('heading', { level: 1, name: 'other' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    await search('octocat')

    expect(within(main()).getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('not found keeps the search available', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'Not Found' }, 404))
    renderAt('/users/ghost-user')

    const alert = await within(profileArea()).findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Conta não encontrada' })).toBeVisible()
    expect(alert).toHaveTextContent('ghost-user')
    expect(within(alert).getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
    expect(within(screen.getByRole('banner')).getByRole('search')).toBeVisible()
  })

  it('retries only on request', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(jsonResponse(octocat))
    renderAt('/users/octocat')

    const alert = await within(profileArea()).findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível conectar ao GitHub.')
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar novamente' }))

    expect(await within(main()).findByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('never retries a rate limit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetchSpy.mockResolvedValue(
      jsonResponse({ message: 'API rate limit exceeded' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1791900300',
      }),
    )
    renderAt('/users/octocat')

    const alert = await within(profileArea()).findByRole('alert')
    expect(alert).toHaveTextContent('O GitHub limitou temporariamente as consultas')
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()

    await act(async () => vi.advanceTimersByTime(60 * 60 * 1000))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
