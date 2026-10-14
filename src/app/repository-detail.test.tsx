import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  abortError,
  deferred,
  githubFetch,
  helloWorld,
  htmlResponse,
  isReadmeUrl,
  jsonResponse,
  octocat,
  repositoriesOf,
} from '../test/github'
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
// The README has its own checks below; these count the repository and list requests.
const apiUrls = () => requestedUrls().filter((url) => !isReadmeUrl(url))
const readmeUrls = () => requestedUrls().filter(isReadmeUrl)
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
    expect(apiUrls()).toEqual(['https://api.github.com/repos/octocat/Hello-World'])
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
    expect(apiUrls()).toHaveLength(2)
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
    const requestsBefore = apiUrls().length
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
    expect(apiUrls().length).toBe(requestsBefore)
  })

  describe('readme', () => {
    const readmeUrl = (owner: string, name: string) => `https://api.github.com/repos/${owner}/${name}/readme`
    const readmeArea = () => within(main()).getByRole('region', { name: 'README' })
    const findReadmeArea = () => within(main()).findByRole('region', { name: 'README' })

    it('back link sits above the card, the README below it', async () => {
      fetchSpy.mockImplementation(githubFetch())
      renderAt('/users/octocat/repos/Hello-World')
      await within(await findReadmeArea()).findByText('Paragraph of Hello-World.')

      const back = backLink()
      const card = within(detailArea()).getByRole('article')
      expect(back).toHaveAttribute('href', '/users/octocat')
      expect(back.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(card.compareDocumentPosition(readmeArea()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('readme after the repository: on direct access, only once the repository answered', async () => {
      const repository = deferred<Response>()
      fetchSpy.mockImplementation((url: string) =>
        isReadmeUrl(url) ? Promise.resolve(htmlResponse('<p>Olá</p>')) : repository.promise,
      )
      renderAt('/users/octocat/repos/Hello-World')

      await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
      expect(readmeUrls()).toEqual([])
      expect(within(main()).queryByRole('region', { name: 'README' })).not.toBeInTheDocument()

      await act(async () => repository.resolve(jsonResponse(helloWorld)))

      expect(await within(readmeArea()).findByText('Olá')).toBeVisible()
      expect(requestedUrls()).toEqual([
        'https://api.github.com/repos/octocat/Hello-World',
        readmeUrl('octocat', 'Hello-World'),
      ])
      const init = fetchSpy.mock.calls[1][1] as RequestInit
      expect(new Headers(init.headers).get('Accept')).toBe('application/vnd.github.html+json')
    })

    it('readme after the repository: from the list cache, exactly one README request', async () => {
      fetchSpy.mockImplementation(githubFetch({ octocat: repositoriesOf('r', 3) }))
      const router = renderAt('/users/octocat')
      await within(main()).findAllByRole('listitem')

      await userEvent.setup().click(within(main()).getByRole('link', { name: 'r-002' }))
      expect(router.state.location.pathname).toBe('/users/octocat/repos/r-002')
      expect(await within(readmeArea()).findByText('Paragraph of r-002.')).toBeVisible()

      expect(readmeUrls()).toEqual([readmeUrl('octocat', 'r-002')])
      expect(apiUrls().filter((url) => url.includes('/repos/octocat/'))).toEqual([])
    })

    it.each([
      ['rate-limited', () =>
        jsonResponse({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791900300' })],
      ['network', () => Promise.reject(new TypeError('Failed to fetch'))],
      ['unexpected', () => jsonResponse({ message: 'Server Error' }, 500)],
    ])('readme failure keeps the card (%s)', async (_kind, fail) => {
      fetchSpy.mockImplementation((url: string) => (isReadmeUrl(url) ? fail() : jsonResponse(helloWorld)))
      renderAt('/users/octocat/repos/Hello-World')

      const alert = await within(await findReadmeArea()).findByRole('alert')
      expect(alert).toBeVisible()
      const card = within(detailArea()).getByRole('article')
      expect(within(card).getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
      expect(within(card).getByText('My first repository on GitHub!')).toBeVisible()
      expect(within(card).getByRole('link', { name: /Ver repositório no GitHub/ })).toBeVisible()
      expect(within(detailArea()).queryByRole('alert')).not.toBeInTheDocument()
    })

    it('readme retry makes one request', async () => {
      let readmeAnswers = 0
      fetchSpy.mockImplementation(async (url: string) => {
        if (!isReadmeUrl(url)) return jsonResponse(helloWorld)
        readmeAnswers += 1
        if (readmeAnswers === 1) throw new TypeError('Failed to fetch')
        return htmlResponse('<p>Agora sim</p>')
      })
      renderAt('/users/octocat/repos/Hello-World')
      const alert = await within(await findReadmeArea()).findByRole('alert')
      expect(alert).toHaveTextContent('Não foi possível conectar ao GitHub.')

      await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar novamente' }))

      expect(await within(readmeArea()).findByText('Agora sim')).toBeVisible()
      expect(readmeUrls()).toHaveLength(2)
      expect(apiUrls()).toHaveLength(1)
    })

    it.each([
      ['200', () => htmlResponse('<p>Guardado</p>'), 'Guardado'],
      ['404', () => jsonResponse({ message: 'Not Found' }, 404), 'Este repositório não tem README.'],
    ])('readme cache: a %s answer is kept, reopened in any case without a request', async (_status, answer, text) => {
      fetchSpy.mockImplementation(async (url: string) => (isReadmeUrl(url) ? answer() : jsonResponse(helloWorld)))
      const router = renderAt('/users/octocat/repos/Hello-World')
      expect(await within(await findReadmeArea()).findByText(text)).toBeVisible()

      await act(() => router.navigate('/foo/bar'))
      await act(() => router.navigate('/users/OctoCat/repos/hello-WORLD'))

      expect(await within(await findReadmeArea()).findByText(text)).toBeVisible()
      expect(readmeUrls()).toEqual([readmeUrl('octocat', 'Hello-World')])
    })

    it('failed readme is requested again when the repository is reopened', async () => {
      let readmeAnswers = 0
      fetchSpy.mockImplementation(async (url: string) => {
        if (!isReadmeUrl(url)) return jsonResponse(helloWorld)
        readmeAnswers += 1
        return readmeAnswers === 1 ? jsonResponse({ message: 'Server Error' }, 500) : htmlResponse('<p>Depois</p>')
      })
      const router = renderAt('/users/octocat/repos/Hello-World')
      expect(await within(await findReadmeArea()).findByRole('alert')).toHaveTextContent('Não foi possível carregar o README.')

      await act(() => router.navigate('/foo/bar'))
      await act(() => router.navigate('/users/octocat/repos/Hello-World'))

      expect(await within(await findReadmeArea()).findByText('Depois')).toBeVisible()
      expect(readmeUrls()).toHaveLength(2)
    })

    it('stale readme is dropped: a late answer never shows in another detail', async () => {
      const late = deferred<Response>()
      fetchSpy.mockImplementation(async (url: string) => {
        if (url === readmeUrl('octocat', 'first')) return late.promise
        if (isReadmeUrl(url)) return htmlResponse('<p>Second README</p>')
        const name = new URL(url).pathname.split('/')[3]
        return jsonResponse({ ...helloWorld, name })
      })
      const router = renderAt('/users/octocat/repos/first')
      await within(await findReadmeArea()).findByText('Carregando README…')
      const firstSignal = signalOf(1)

      await act(() => router.navigate('/users/octocat/repos/second'))
      expect(firstSignal.aborted).toBe(true)
      expect(await within(await findReadmeArea()).findByText('Second README')).toBeVisible()

      await act(async () => late.resolve(htmlResponse('<p>First README</p>')))
      expect(within(main()).queryByText('First README')).not.toBeInTheDocument()
      expect(within(readmeArea()).getByText('Second README')).toBeVisible()

      await act(() => router.navigate('/foo/bar'))
      expect(within(main()).queryByText('First README')).not.toBeInTheDocument()
    })

    it.each([
      ['not found', () => jsonResponse({ message: 'Not Found' }, 404)],
      ['network', () => Promise.reject(new TypeError('Failed to fetch'))],
      ['rate-limited', () =>
        jsonResponse({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791900300' })],
      ['unexpected', () => jsonResponse({ message: 'Server Error' }, 500)],
    ])('no readme for a failed detail (%s)', async (_kind, fail) => {
      fetchSpy.mockImplementation(fail)
      renderAt('/users/octocat/repos/Hello-World')

      await within(detailArea()).findByRole('alert')
      await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
      expect(readmeUrls()).toEqual([])
      expect(within(main()).queryByRole('region', { name: 'README' })).not.toBeInTheDocument()
    })
  })
})
