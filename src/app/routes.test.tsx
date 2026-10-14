import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RouteObject } from 'react-router-dom'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usedClasses, usesToken, withoutVariants } from '../test/classes'
import { deferred, githubFetch, jsonResponse, octocat, repositoriesOf } from '../test/github'
import { spacingReport } from '../test/spacing'
import { tokensOf } from '../test/theme'
import { routes } from './routes'

const createBrowserRouter = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  createBrowserRouter.mockImplementation(actual.createBrowserRouter)
  return { ...actual, createBrowserRouter }
})

const screens = [
  '/',
  '/users/octocat',
  '/users/octocat/repos/hello-world',
  '/foo/bar',
]

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(<RouterProvider router={router} />)
  return { ...view, router }
}

function searchField() {
  return within(screen.getByRole('banner')).getByRole('textbox', {
    name: 'Nome de usuário do GitHub',
  })
}

function routePaths(list: RouteObject[], parent = ''): string[] {
  return list.flatMap((route) => {
    const own = route.index
      ? parent || '/'
      : route.path
        ? `${parent.replace(/\/$/, '')}/${route.path.replace(/^\//, '')}`
        : parent
    const children = route.children ? routePaths(route.children, own) : []
    return route.path || route.index ? [own, ...children] : children
  })
}

function allRoutes(list: RouteObject[]): RouteObject[] {
  return list.flatMap((route) => [route, ...allRoutes(route.children ?? [])])
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  // The profile route requests its user, then its repositories, and the detail route its
  // repository; every user mirrors octocat and has none, and every repository mirrors
  // Hello-World, unless a test says otherwise.
  fetchSpy = vi.fn(githubFetch())
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('routes', () => {
  it('declares the route contract', async () => {
    expect(new Set(routePaths(routes))).toEqual(
      new Set(['/', '/users/:username', '/users/:username/repos/:repoName', '/*']),
    )
    for (const route of allRoutes(routes)) {
      expect(route).not.toHaveProperty('loader')
      expect(route).not.toHaveProperty('action')
      expect(route).not.toHaveProperty('lazy')
    }

    await import('./App')
    expect(createBrowserRouter).toHaveBeenCalledWith(routes)
  })

  it('renders the profile and the repository detail', async () => {
    renderAt('/users/octocat')
    expect(await screen.findByRole('heading', { level: 1, name: /octocat/ })).toBeVisible()

    const detail = within(renderAt('/users/octocat/repos/hello-world').container)
    expect(await detail.findByRole('heading', { level: 1, name: 'hello-world' })).toBeVisible()
    // The detail belongs to the user in the URL: its way back goes to that user's list.
    expect(detail.getByRole('link', { name: 'Voltar aos repositórios' })).toHaveAttribute('href', '/users/octocat')
  })

  it('unknown route shows not found with a link home and no request', async () => {
    renderAt('/foo/bar')

    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
    expect(within(main).getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('home: one search, in the hero', () => {
    renderAt('/')

    const banner = screen.getByRole('banner')
    expect(within(banner).queryByRole('search')).not.toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: 'GitHub Explorer' })).toHaveAttribute('href', '/')
    expect(within(banner).getByRole('button', { name: 'Usar tema escuro' })).toBeInTheDocument()
    const [search, ...others] = screen.getAllByRole('search')
    expect(others).toEqual([])
    expect(within(screen.getByRole('main')).getByRole('search')).toBe(search)
    expect(within(search).getByRole('textbox', { name: 'Nome de usuário do GitHub' })).toBeVisible()
    expect(within(search).getByRole('button', { name: 'Buscar' })).toBeVisible()
    expect(within(search).getByText('Use o login exato da conta, por exemplo octocat.')).not.toHaveClass('sr-only')
  })

  it('example link opens the profile without query', async () => {
    const user = userEvent.setup()
    const { router } = renderAt('/')

    await user.click(screen.getByRole('link', { name: 'torvalds' }))

    expect(router.state.location.pathname).toBe('/users/torvalds')
    expect(router.state.location.search).toBe('')
    expect(await screen.findByRole('heading', { level: 1, name: 'torvalds' })).toBeVisible()
  })

  it.each(screens.filter((path) => path !== '/'))('header search on every other screen (%s)', async (path) => {
    renderAt(path)

    const banner = screen.getByRole('banner')
    const search = within(banner).getByRole('search')
    expect(within(search).getByRole('textbox', { name: 'Nome de usuário do GitHub' })).toBeVisible()
    // On the profile route the button reads "Buscando…" until the profile arrives.
    expect(await within(search).findByRole('button', { name: 'Buscar' })).toBeVisible()
  })

  it.each([
    ['hero', '/'],
    ['header', '/foo/bar'],
  ])('blank search stays put and requests nothing (%s)', async (_place, path) => {
    const user = userEvent.setup()
    const { router } = renderAt(path)
    const search = screen.getByRole('search')
    const field = within(search).getByRole('textbox', { name: 'Nome de usuário do GitHub' })

    await user.type(field, '   {Enter}')
    expect(field).toHaveFocus()
    expect(within(search).getByText('Digite um nome de usuário para buscar.')).toBeVisible()
    await user.click(within(search).getByRole('button', { name: 'Buscar' }))

    expect(router.state.location.pathname).toBe(path)
    expect(router.state.historyAction).toBe('POP')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('navigates to the profile without query', async () => {
    const user = userEvent.setup()
    const { router } = renderAt('/users/x?sort=name-asc&page=2')
    // Each profile settles (profile, then its empty repositories) before the next search.
    await screen.findByText('Esta conta não tem repositórios públicos.')

    await user.type(searchField(), '  octocat  {Enter}')
    expect(router.state.location.pathname).toBe('/users/octocat')
    expect(router.state.location.search).toBe('')
    await screen.findByText('Esta conta não tem repositórios públicos.')

    await user.type(searchField(), 'a b/c{Enter}')
    expect(router.state.location.pathname).toBe('/users/a%20b%2Fc')
    expect(router.state.location.search).toBe('')
    // The search only navigates; the requests that follow are the profile route's, for that login.
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenLastCalledWith(
        'https://api.github.com/users/a%20b%2Fc/repos?per_page=100&page=1',
        expect.anything(),
      ),
    )
    expect(fetchSpy).toHaveBeenCalledWith('https://api.github.com/users/a%20b%2Fc', expect.anything())
    // Per profile visited (x, octocat, a b/c): its profile, then its repositories. The search
    // adds no request of its own.
    expect(fetchSpy.mock.calls.map(([url]) => url as string)).toEqual([
      'https://api.github.com/users/x',
      'https://api.github.com/users/x/repos?per_page=100&page=1',
      'https://api.github.com/users/octocat',
      'https://api.github.com/users/octocat/repos?per_page=100&page=1',
      'https://api.github.com/users/a%20b%2Fc',
      'https://api.github.com/users/a%20b%2Fc/repos?per_page=100&page=1',
    ])
    expect(fetchSpy).toHaveBeenCalledTimes(6)
  })

  it('field starts empty after navigation', async () => {
    const user = userEvent.setup()
    renderAt('/foo/bar')

    await user.type(searchField(), 'octocat{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: /octocat/ })).toBeVisible()
    expect(searchField()).toHaveValue('')
  })

  it('disables search while the profile loads', async () => {
    const pending = deferred<Response>()
    fetchSpy.mockReturnValue(pending.promise)
    renderAt('/users/octocat')

    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()

    await act(async () => pending.resolve(jsonResponse(octocat)))
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled()
  })

  it.each(screens)('spacing on every screen (%s)', async (path) => {
    const { container } = renderAt(path)
    const rawClasses = usedClasses(container)
    const classes = withoutVariants(rawClasses)

    expect(usesToken(classes, ['bg', 'text', 'border'], tokensOf('color')), 'color').toBe(true)
    expect(usesToken(classes, ['text'], tokensOf('text')), 'typography').toBe(true)
    const { spacing, offScale } = await spacingReport(rawClasses)
    expect(spacing.length, 'spacing').toBeGreaterThan(0)
    expect(offScale, 'spacing off the DESIGN.md scale').toEqual([])
  })

  it.each([
    ['home with hero and examples', '/', () => screen.getByTestId('hero-glow')],
    ['profile with cover, tiles and pager', '/users/octocat', () => screen.findByRole('navigation', { name: 'Páginas de repositórios' })],
    ['detail with README', '/users/octocat/repos/hello-world', () => screen.findByTestId('readme-content')],
  ])('spacing on the loaded %s', async (_name, path, ready) => {
    fetchSpy.mockImplementation(githubFetch({ octocat: repositoriesOf('r', 45) }))
    const { container } = renderAt(path)
    await ready()
    const rawClasses = usedClasses(container)

    const { spacing, offScale } = await spacingReport(rawClasses)
    expect(spacing.length, 'spacing').toBeGreaterThan(0)
    expect(offScale, 'spacing off the DESIGN.md scale').toEqual([])
  })
})
