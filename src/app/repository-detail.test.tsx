import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abortError, deferred, githubFetch, helloWorld, jsonResponse, octocat, repositoriesOf } from '../test/github'
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

type Entry = string | { pathname: string; state?: unknown }

function renderAt(entry: Entry) {
  const router = createMemoryRouter(routes, { initialEntries: [entry] })
  render(<RouterProvider router={router} />)
  return router
}

const main = () => screen.getByRole('main')
const detailArea = () => within(main()).getByRole('region', { name: 'Repositório' })
const backLink = () => within(main()).getByRole('link', { name: 'Voltar aos repositórios' })
const requestedUrls = () => fetchSpy.mock.calls.map(([url]) => url as string)
const signalOf = (call: number) => (fetchSpy.mock.calls[call][1] as RequestInit).signal as AbortSignal

describe('repository detail route', () => {
  it('direct access requests the repository once and shows it', async () => {
    const pending = deferred<Response>()
    fetchSpy.mockReturnValue(pending.promise)
    renderAt('/users/octocat/repos/Hello-World')

    expect(within(detailArea()).getByTestId('repository-skeleton')).toBeInTheDocument()
    expect(within(detailArea()).getByText('Carregando repositório…')).toHaveAttribute('aria-live', 'polite')

    await act(async () => pending.resolve(jsonResponse(helloWorld)))

    expect(within(main()).getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
    expect(requestedUrls()).toEqual(['https://api.github.com/repos/octocat/Hello-World'])
  })

  it('not found links back to the profile and keeps the search', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'Not Found' }, 404))
    renderAt('/users/octocat/repos/nope')

    const alert = await within(detailArea()).findByRole('alert')
    expect(within(alert).getByRole('heading', { level: 1, name: 'Repositório não encontrado' })).toBeVisible()
    expect(within(alert).getByRole('link', { name: 'Voltar ao perfil de octocat' })).toHaveAttribute(
      'href',
      '/users/octocat',
    )
    expect(within(screen.getByRole('banner')).getByRole('search')).toBeVisible()
  })

  it('retries only on request', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(jsonResponse(helloWorld))
    renderAt('/users/octocat/repos/Hello-World')

    const alert = await within(detailArea()).findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível conectar ao GitHub.')
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar novamente' }))

    expect(await within(main()).findByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
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
    renderAt('/users/octocat/repos/Hello-World')

    const alert = await within(detailArea()).findByRole('alert')
    expect(alert).toHaveTextContent('O GitHub limitou temporariamente as consultas')
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()

    await act(async () => vi.advanceTimersByTime(60 * 60 * 1000))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('aborts silently on leave', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const pending = deferred<Response>()
    fetchSpy.mockReturnValue(pending.promise)
    const router = renderAt('/users/octocat/repos/Hello-World')

    await act(() => router.navigate('/'))

    expect(signalOf(0).aborted).toBe(true)
    await act(async () => pending.reject(abortError()))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('aborts the previous repository and discards its late answer', async () => {
    const a = deferred<Response>()
    const b = deferred<Response>()
    fetchSpy.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const router = renderAt('/users/octocat/repos/repo-a')

    await act(() => router.navigate('/users/octocat/repos/repo-b'))

    expect(signalOf(0).aborted).toBe(true)
    expect(signalOf(1).aborted).toBe(false)
    await act(async () => a.resolve(jsonResponse({ ...helloWorld, name: 'repo-a', description: 'Descrição A' })))
    expect(main()).not.toHaveTextContent('Descrição A')
    expect(within(detailArea()).getByTestId('repository-skeleton')).toBeInTheDocument()
    await act(async () => b.resolve(jsonResponse({ ...helloWorld, name: 'repo-b', description: 'Descrição B' })))
    expect(within(main()).getByRole('heading', { level: 1, name: 'repo-b' })).toBeVisible()
    expect(main()).not.toHaveTextContent('Descrição A')
  })

  describe('back link', () => {
    it('is there while loading, after success and after an error', async () => {
      const pending = deferred<Response>()
      fetchSpy.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(jsonResponse({ message: 'x' }, 500))
      const router = renderAt('/users/octocat/repos/Hello-World')

      expect(backLink()).toHaveAttribute('href', '/users/octocat')
      await act(async () => pending.resolve(jsonResponse(helloWorld)))
      expect(within(main()).getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
      expect(backLink()).toHaveAttribute('href', '/users/octocat')

      await act(() => router.navigate('/users/octocat/repos/broken'))
      expect(await within(detailArea()).findByRole('alert')).toHaveTextContent('Algo deu errado')
      expect(backLink()).toHaveAttribute('href', '/users/octocat')
    })

    it('on direct access leads to the default list of the user', async () => {
      fetchSpy.mockImplementation(async (url: string) =>
        jsonResponse(url.includes('/repos/') ? helloWorld : octocat),
      )
      const router = renderAt('/users/octocat/repos/Hello-World')
      await within(main()).findByRole('heading', { level: 1, name: 'Hello-World' })

      await userEvent.setup().click(backLink())

      expect(router.state.location.pathname).toBe('/users/octocat')
      expect(router.state.location.search).toBe('')
      expect(await within(main()).findByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
    })

    it('back link keeps the list query the user came from', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(helloWorld))
      renderAt({
        pathname: '/users/octocat/repos/Hello-World',
        state: { listSearch: '?sort=name-asc&page=2' },
      })

      expect(backLink()).toHaveAttribute('href', '/users/octocat?sort=name-asc&page=2')
    })

    it('ignores a history state that is not a query', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(helloWorld))
      renderAt({ pathname: '/users/octocat/repos/Hello-World', state: { listSearch: '//evil.example' } })

      expect(backLink()).toHaveAttribute('href', '/users/octocat')
    })
  })

  it('from the list: opens without a request and goes back to the same sort and page', async () => {
    fetchSpy.mockImplementation(githubFetch({ octocat: repositoriesOf('r', 45) }))
    const router = renderAt('/users/octocat?sort=name-asc&page=2')
    const list = await within(main()).findByRole('region', { name: 'Repositórios' })
    await within(list).findByText('2 de 2')
    const requestsBefore = fetchSpy.mock.calls.length
    const user = userEvent.setup()

    await user.click(within(list).getByRole('link', { name: 'r-031' }))

    expect(router.state.location.pathname).toBe('/users/octocat/repos/r-031')
    expect(within(main()).getByRole('heading', { level: 1, name: 'r-031' })).toBeVisible()
    expect(backLink()).toHaveAttribute('href', '/users/octocat?sort=name-asc&page=2')

    await user.click(backLink())

    expect(router.state.location.pathname).toBe('/users/octocat')
    expect(router.state.location.search).toBe('?sort=name-asc&page=2')
    const back = within(main()).getByRole('region', { name: 'Repositórios' })
    expect(within(back).getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    expect(fetchSpy.mock.calls.length).toBe(requestsBefore)
  })
})
