import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RouteObject } from 'react-router-dom'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitHubContext } from '../context/GitHubContext'
import { usedClasses, usesToken, withoutVariants } from '../test/classes'
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

function renderAt(path: string, isProfileLoading = false) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const tree = (loading: boolean) => (
    <GitHubContext value={{ isProfileLoading: loading }}>
      <RouterProvider router={router} />
    </GitHubContext>
  )
  const view = render(tree(isProfileLoading))
  return { ...view, router, setLoading: (loading: boolean) => view.rerender(tree(loading)) }
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
  fetchSpy = vi.fn()
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

  it('renders placeholders for the profile and the repository', async () => {
    renderAt('/users/octocat')
    expect(await screen.findByRole('heading', { level: 1, name: /octocat/ })).toBeVisible()

    const detail = within(renderAt('/users/octocat/repos/hello-world').container)
    expect(await detail.findByRole('heading', { level: 1, name: /hello-world/ })).toBeVisible()
    expect(detail.getByRole('main')).toHaveTextContent('octocat')
  })

  it('unknown route shows not found with a link home and no request', async () => {
    renderAt('/foo/bar')

    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
    expect(within(main).getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it.each(screens)('header search on every screen (%s)', (path) => {
    renderAt(path)

    const banner = screen.getByRole('banner')
    const search = within(banner).getByRole('search')
    expect(within(search).getByRole('textbox', { name: 'Nome de usuário do GitHub' })).toBeVisible()
    expect(within(search).getByRole('button', { name: 'Buscar' })).toBeVisible()
  })

  it('blank search stays put and requests nothing', async () => {
    const user = userEvent.setup()
    const { router } = renderAt('/')

    await user.type(searchField(), '   {Enter}')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(router.state.location.pathname).toBe('/')
    expect(router.state.historyAction).toBe('POP')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('navigates to the profile without query', async () => {
    const user = userEvent.setup()
    const { router } = renderAt('/users/x?sort=name-asc&page=2')

    await user.type(searchField(), '  octocat  {Enter}')
    expect(router.state.location.pathname).toBe('/users/octocat')
    expect(router.state.location.search).toBe('')

    await user.type(searchField(), 'a b/c{Enter}')
    expect(router.state.location.pathname).toBe('/users/a%20b%2Fc')
    expect(router.state.location.search).toBe('')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('field starts empty after navigation', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.type(searchField(), 'octocat{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: /octocat/ })).toBeVisible()
    expect(searchField()).toHaveValue('')
  })

  it('disables search while the profile loads', () => {
    const { setLoading } = renderAt('/users/octocat', true)

    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()

    setLoading(false)
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
})
