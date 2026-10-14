import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deferred,
  githubFetch,
  isRepositoriesUrl,
  jsonResponse,
  pageOf,
  repositoriesOf,
  repositoriesPage,
  repositoryOf,
} from '../test/github'
import type { Repository } from '../types/github'
import { routes } from './routes'

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn(githubFetch())
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const main = () => screen.getByRole('main')
const section = () => within(main()).getByRole('region', { name: 'Repositórios' })
const findSection = () => within(main()).findByRole('region', { name: 'Repositórios' })
const urls = () => fetchSpy.mock.calls.map(([url]) => url as string)
const repoUrls = () => urls().filter(isRepositoriesUrl)
const profileUrls = () => urls().filter((url) => !isRepositoriesUrl(url))
const itemNames = () =>
  within(section())
    .queryAllByRole('listitem')
    .map((item) => within(item).getByRole('link').textContent)
const sortGroup = () => within(section()).getByRole('radiogroup', { name: 'Ordenar por' })
const sortOption = (name: string) => within(sortGroup()).getByRole('radio', { name })
const selectedSort = () =>
  (within(sortGroup()).getAllByRole('radio') as HTMLInputElement[]).find((radio) => radio.checked)?.closest('label')
    ?.textContent
/** The pager shows page `page` of `total`: the current number, and the compact "p de N". */
function expectPage(page: number, total: number) {
  const pager = within(section()).getByRole('navigation', { name: 'Páginas de repositórios' })
  expect(within(pager).getByRole('button', { name: `Página ${page}` })).toHaveAttribute('aria-current', 'page')
  expect(within(pager).getByTestId('pager-compact')).toHaveTextContent(`${page} de ${total}`)
  expect(within(pager).getByTestId('pager-numbers').querySelectorAll('[aria-current="page"]')).toHaveLength(1)
}
const reposUrl = (login: string, page: number) =>
  `https://api.github.com/users/${login}/repos?per_page=100&page=${page}`

async function search(login: string) {
  const field = within(screen.getByRole('banner')).getByRole('textbox', { name: 'Nome de usuário do GitHub' })
  await userEvent.setup().type(field, `${login}{Enter}`)
}

/** Waits until the list is on screen, then forgets the requests made so far. */
async function loaded(path: string, repositories: Record<string, Repository[]>) {
  fetchSpy.mockImplementation(githubFetch(repositories))
  const router = renderAt(path)
  await within(await findSection()).findAllByRole('listitem')
  const before = fetchSpy.mock.calls.length
  return { router, newRequests: () => fetchSpy.mock.calls.length - before }
}

/** 237 repositories over 3 API pages; the one with most stars arrives on page 3. */
function threePages() {
  const pages = [repositoriesOf('a', 100, () => 10), repositoriesOf('b', 100, () => 20), repositoriesOf('c', 37, () => 5)]
  pages[2][36] = repositoryOf('star-of-page-3', { stargazers_count: 9999 })
  return pages
}

describe('repository list route', () => {
  it.each([
    ['not-found', () => jsonResponse({ message: 'Not Found' }, 404)],
    ['network', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['rate-limited', () => jsonResponse({}, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791900300' })],
    ['unexpected', () => jsonResponse({ message: 'Server Error' }, 500)],
  ])('no repository request when the profile fails (%s)', async (_kind, failure) => {
    fetchSpy.mockImplementation(async (url: string) => (isRepositoriesUrl(url) ? githubFetch()(url) : failure()))
    renderAt('/users/octocat')

    await within(main()).findByRole('alert')
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)))

    expect(repoUrls()).toEqual([])
    expect(within(main()).queryByRole('region', { name: 'Repositórios' })).not.toBeInTheDocument()
  })

  it('progress per page: the profile stays, the section counts pages, no partial item', async () => {
    const pages = threePages()
    const pending = pages.map(() => deferred<Response>())
    fetchSpy.mockImplementation(async (url: string) =>
      isRepositoriesUrl(url) ? pending[pageOf(url) - 1].promise : githubFetch()(url),
    )
    renderAt('/users/octocat')
    const live = async () => (await findSection()).querySelector('[aria-live="polite"]') as HTMLElement

    expect(await live()).toHaveTextContent('Carregando repositórios… (página 1)')
    for (const page of [1, 2]) {
      await act(async () => pending[page - 1].resolve(repositoriesPage(pages[page - 1], page, 3)))
      expect(await live()).toHaveTextContent(`Carregando repositórios… (página ${page + 1})`)
      expect(within(main()).getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
      expect(within(section()).queryAllByRole('listitem')).toHaveLength(0)
    }

    await act(async () => pending[2].resolve(repositoriesPage(pages[2], 3, 3)))
    expect(within(section()).getAllByRole('listitem')).toHaveLength(30)
    expect(await live()).toHaveTextContent(/^$/)
    expect(repoUrls()).toEqual([reposUrl('octocat', 1), reposUrl('octocat', 2), reposUrl('octocat', 3)])
  })

  it('switching user mid-pagination aborts, asks no next page and shows only the new user', async () => {
    const pageTwoOfA = deferred<Response>()
    const reposOfB = [repositoryOf('only-b')]
    fetchSpy.mockImplementation(async (url: string) => {
      if (url === reposUrl('a', 1)) return repositoriesPage(repositoriesOf('of-a', 100), 1, 3)
      if (url === reposUrl('a', 2)) return pageTwoOfA.promise
      return githubFetch({ b: reposOfB })(url)
    })
    const router = renderAt('/users/a')
    await waitFor(() => expect(repoUrls()).toContain(reposUrl('a', 2)))
    const signal = (fetchSpy.mock.calls.find(([url]) => url === reposUrl('a', 2))![1] as RequestInit).signal!

    await act(() => router.navigate('/users/b'))

    expect(signal.aborted).toBe(true)
    // The stub ignores the abort, as a response already in flight would.
    await act(async () => pageTwoOfA.resolve(repositoriesPage(repositoriesOf('of-a-2', 100), 2, 3)))
    await within(await findSection()).findAllByRole('listitem')
    expect(itemNames()).toEqual(['only-b'])
    expect(main()).not.toHaveTextContent(/of-a/)
    expect(repoUrls()).not.toContain(reposUrl('a', 3))
  })

  it('leaving mid-pagination aborts and asks no next page', async () => {
    const pageOne = deferred<Response>()
    fetchSpy.mockImplementation(async (url: string) =>
      isRepositoriesUrl(url) ? pageOne.promise : githubFetch()(url),
    )
    const router = renderAt('/users/octocat')
    await waitFor(() => expect(repoUrls()).toHaveLength(1))

    await act(() => router.navigate('/'))

    expect((fetchSpy.mock.calls.find(([url]) => isRepositoriesUrl(url as string))![1] as RequestInit).signal!.aborted).toBe(true)
    await act(async () => pageOne.resolve(repositoriesPage(repositoriesOf('x', 100), 1, 2)))
    expect(repoUrls()).toEqual([reposUrl('octocat', 1)])
  })

  it('serves cached repositories when coming back to the profile', async () => {
    const { router, newRequests } = await loaded('/users/octocat', { octocat: repositoriesOf('r', 3) })

    await act(() => router.navigate('/users/octocat/repos/r-001'))
    await act(() => router.navigate(-1))

    expect(await within(await findSection()).findAllByRole('listitem')).toHaveLength(3)
    expect(newRequests()).toBe(0)
  })

  it.each([
    ['network', () => Promise.reject(new TypeError('Failed to fetch')), 'Não foi possível conectar ao GitHub.'],
    [
      'rate-limited',
      () => jsonResponse({}, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(new Date(2026, 9, 12, 14, 5).getTime() / 1000) }),
      'O GitHub limitou temporariamente as consultas',
    ],
    ['unexpected', () => jsonResponse({ message: 'Server Error' }, 500), 'Algo deu errado'],
  ])('page 2 fails (%s): the section shows the error, the profile stays', async (_kind, failure, text) => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (isRepositoriesUrl(url) && pageOf(url) === 2) return failure()
      return githubFetch({ octocat: repositoriesOf('r', 150) })(url)
    })
    renderAt('/users/octocat')

    const alert = await within(await findSection()).findByRole('alert')
    expect(alert).toHaveTextContent(text)
    if (_kind === 'rate-limited') expect(alert).toHaveTextContent('14:05')
    expect(within(section()).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(main()).getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
    expect(within(main()).getAllByRole('alert')).toHaveLength(1)
    expect(repoUrls()).toEqual([reposUrl('octocat', 1), reposUrl('octocat', 2)])
  })

  it.each([
    ['click', async (button: HTMLElement) => userEvent.setup().click(button)],
    ['Enter', async (button: HTMLElement) => { button.focus(); await userEvent.setup().keyboard('{Enter}') }],
  ])('retry restarts at page 1 without the profile (%s)', async (_trigger, activate) => {
    let failures = 1
    fetchSpy.mockImplementation(async (url: string) => {
      if (isRepositoriesUrl(url) && pageOf(url) === 2 && failures-- > 0) throw new TypeError('Failed to fetch')
      return githubFetch({ octocat: repositoriesOf('r', 150) })(url)
    })
    renderAt('/users/octocat')
    const alert = await within(await findSection()).findByRole('alert')
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)))
    expect(repoUrls()).toHaveLength(2)

    await activate(within(alert).getByRole('button', { name: 'Tentar novamente' }))

    expect(await within(section()).findAllByRole('listitem')).toHaveLength(30)
    expect(repoUrls().map(pageOf)).toEqual([1, 2, 1, 2])
    expect(profileUrls()).toEqual(['https://api.github.com/users/octocat'])
  })

  it('empty: page 1 is [] although the profile counts public repositories', async () => {
    renderAt('/users/octocat')

    expect(await within(await findSection()).findByText('Esta conta não tem repositórios públicos.')).toBeVisible()
    expect(within(section()).queryByRole('alert')).not.toBeInTheDocument()
    expect(repoUrls()).toEqual([reposUrl('octocat', 1)])
  })

  it('sorts the whole set: the top of API page 3 is first on page 1', async () => {
    const pages = threePages()
    await loaded('/users/octocat', { octocat: pages.flat() })

    expect(itemNames()[0]).toBe('star-of-page-3')
    expectPage(1, 8)
  })

  it('invalid sort falls back to stars, most first', async () => {
    await loaded('/users/octocat?sort=xyz', {
      octocat: [repositoryOf('few', { stargazers_count: 1 }), repositoryOf('many', { stargazers_count: 9 })],
    })

    expect(selectedSort()).toBe('Mais estrelas')
    expect(itemNames()).toEqual(['many', 'few'])
  })

  it('shows the selected sort from the URL', async () => {
    await loaded('/users/octocat?sort=updated-desc', {
      octocat: [
        repositoryOf('older', { updated_at: '2026-01-01T12:00:00Z', stargazers_count: 9 }),
        repositoryOf('newer', { updated_at: '2026-10-01T12:00:00Z' }),
      ],
    })

    expect(selectedSort()).toBe('Atualização')
    expect(itemNames()).toEqual(['newer', 'older'])
  })

  it('changing the sort writes sort and page=1 to the URL and requests nothing', async () => {
    const repositories = repositoriesOf('r', 70, (index) => index)
    const { router, newRequests } = await loaded('/users/octocat?page=3', { octocat: repositories })
    expect(itemNames()[0]).toBe('r-010')

    await userEvent.setup().click(sortOption('Nome'))

    expect(router.state.location.search).toBe('?sort=name-asc&page=1')
    expect(itemNames()[0]).toBe('r-001')
    expectPage(1, 3)
    expect(newRequests()).toBe(0)
  })

  it.each([
    ['?sort=stars-desc', 'Mais estrelas'],
    ['?sort=stars-asc', 'Menos estrelas'],
    ['?sort=name-asc', 'Nome'],
    ['?sort=updated-desc', 'Atualização'],
    ['?sort=STARS-ASC', 'Mais estrelas'],
    ['', 'Mais estrelas'],
  ])('sort pill reflects the URL (%s)', async (query, checked) => {
    await loaded(`/users/octocat${query}`, { octocat: repositoriesOf('r', 3) })

    expect(within(sortGroup()).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
      'Mais estrelas',
      'Menos estrelas',
      'Nome',
      'Atualização',
    ])
    expect(selectedSort()).toBe(checked)
    expect(sortOption(checked)).toBeChecked()
  })

  it('choosing a sort pill pushes sort and page=1 and shows that first page', async () => {
    const repositories = repositoriesOf('r', 70, (index) => index)
    const { router, newRequests } = await loaded('/users/octocat?page=3', { octocat: repositories })

    await userEvent.setup().click(sortOption('Menos estrelas'))

    expect(router.state.location.search).toBe('?sort=stars-asc&page=1')
    expect(router.state.historyAction).toBe('PUSH')
    expect(itemNames()).toEqual(repositories.slice(0, 30).map((repository) => repository.name))
    expect(sortOption('Menos estrelas')).toBeChecked()
    expectPage(1, 3)
    expect(newRequests()).toBe(0)
  })

  it('page number keeps the sort, pushes the page and keeps the focus on it', async () => {
    const { router, newRequests } = await loaded('/users/octocat?sort=name-asc', { octocat: repositoriesOf('r', 70) })
    const pager = within(section()).getByRole('navigation', { name: 'Páginas de repositórios' })

    await userEvent.setup().click(within(pager).getByRole('button', { name: 'Página 3' }))

    expect(router.state.location.search).toBe('?sort=name-asc&page=3')
    expect(router.state.historyAction).toBe('PUSH')
    expect(itemNames()[0]).toBe('r-061')
    const current = within(pager).getByRole('button', { name: 'Página 3' })
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current).toHaveFocus()
    expect(newRequests()).toBe(0)
  })

  it('out of range page shows page 1', async () => {
    await loaded('/users/octocat?page=99', { octocat: repositoriesOf('r', 37) })

    expectPage(1, 2)
    expect(itemNames()[0]).toBe('r-001')
  })

  it('30 per page: 37 repositories are 30 on page 1 and 7 on page 2', async () => {
    await loaded('/users/octocat?sort=name-asc', { octocat: repositoriesOf('r', 37) })
    expect(itemNames()).toHaveLength(30)

    await userEvent.setup().click(within(section()).getByRole('button', { name: 'Próxima' }))

    expect(itemNames()).toEqual(repositoriesOf('r', 37).slice(30).map((repository) => repository.name))
  })

  it('changing the page writes page to the URL, keeps the sort and requests nothing', async () => {
    const { router, newRequests } = await loaded('/users/octocat?sort=name-asc', { octocat: repositoriesOf('r', 70) })

    await userEvent.setup().click(within(section()).getByRole('button', { name: 'Próxima' }))
    expect(router.state.location.search).toBe('?sort=name-asc&page=2')
    expectPage(2, 3)

    within(section()).getByRole('button', { name: 'Anterior' }).focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(router.state.location.search).toBe('?sort=name-asc&page=1')
    expect(newRequests()).toBe(0)
  })

  it.each([
    ['click', async (button: HTMLElement) => userEvent.setup().click(button)],
    ['Enter', async (button: HTMLElement) => { button.focus(); await userEvent.setup().keyboard('{Enter}') }],
  ])('focus moves to the opposite pager button at a limit (%s)', async (_trigger, activate) => {
    await loaded('/users/octocat', { octocat: repositoriesOf('r', 45) })
    const button = (name: string) => within(section()).getByRole('button', { name })

    await activate(button('Próxima'))
    expectPage(2, 2)
    expect(button('Próxima')).toBeDisabled()
    expect(button('Anterior')).toHaveFocus()

    await activate(button('Anterior'))
    expectPage(1, 2)
    expect(button('Anterior')).toBeDisabled()
    expect(button('Próxima')).toHaveFocus()
  })

  it('pager keeps the focus on the clicked button away from the limits', async () => {
    await loaded('/users/octocat', { octocat: repositoriesOf('r', 70) })
    const next = within(section()).getByRole('button', { name: 'Próxima' })

    await userEvent.setup().click(next)

    expectPage(2, 3)
    expect(next).toHaveFocus()
  })

  it.each([
    ['click', async (link: HTMLElement) => userEvent.setup().click(link)],
    ['Enter', async (link: HTMLElement) => { link.focus(); await userEvent.setup().keyboard('{Enter}') }],
  ])('opens the detail by %s, with the name encoded, and requests nothing', async (_trigger, activate) => {
    const { router, newRequests } = await loaded('/users/octocat', { octocat: [repositoryOf('a b#c')] })

    await activate(within(section()).getByRole('link', { name: 'a b#c' }))

    expect(router.state.location.pathname).toBe('/users/octocat/repos/a%20b%23c')
    expect(newRequests()).toBe(0)
  })

  it('back restores sort and page after the detail, without requests', async () => {
    const { router, newRequests } = await loaded('/users/octocat?sort=name-asc&page=2', {
      octocat: repositoriesOf('r', 45),
    })
    await userEvent.setup().click(within(section()).getByRole('link', { name: 'r-031' }))
    expect(router.state.location.pathname).toBe('/users/octocat/repos/r-031')

    await act(() => router.navigate(-1))

    expect(router.state.location.pathname).toBe('/users/octocat')
    expect(router.state.location.search).toBe('?sort=name-asc&page=2')
    await within(await findSection()).findByText('2 de 2')
    expectPage(2, 2)
    expect(selectedSort()).toBe('Nome')
    expect(itemNames()[0]).toBe('r-031')
    expect(newRequests()).toBe(0)
  })

  it('new search resets to /users/<new> without query, stars first, page 1', async () => {
    const { router } = await loaded('/users/octocat?sort=name-asc&page=2', {
      octocat: repositoriesOf('r', 45),
      other: repositoriesOf('o', 45),
    })

    await search('other')

    expect(router.state.location.pathname).toBe('/users/other')
    expect(router.state.location.search).toBe('')
    await within(await findSection()).findAllByRole('listitem')
    expect(selectedSort()).toBe('Mais estrelas')
    expectPage(1, 2)
  })
})
