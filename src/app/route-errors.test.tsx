import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usedClasses, usesToken, withoutVariants } from '../test/classes'
import { githubFetch } from '../test/github'
import { spacingReport } from '../test/spacing'
import { tokensOf } from '../test/theme'
import { routes } from './routes'

const crash = vi.hoisted(() => ({ page: false, header: false }))

vi.mock('../pages/RepositoryPage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../pages/RepositoryPage')>()
  return {
    default: function CrashingRepositoryPage() {
      if (crash.page) throw new Error('page render failed')
      return <actual.default />
    },
  }
})

vi.mock('../components/layout/AppHeader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/layout/AppHeader')>()
  return {
    default: function CrashingAppHeader() {
      if (crash.header) throw new Error('header render failed')
      return <actual.default />
    },
  }
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const { container } = render(<RouterProvider router={router} />)
  return Object.assign(router, { container })
}

const errorScreens = [
  ['route error', 'page', '/users/octocat/repos/hello-world'],
  ['root error', 'header', '/'],
] as const

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  // The header search lands on the profile route, which requests its user and repositories.
  fetchSpy = vi.fn(githubFetch())
  vi.stubGlobal('fetch', fetchSpy)
  // React and the router report caught render errors on the console.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  crash.page = false
  crash.header = false
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('route errors', () => {
  it('render error keeps the header usable', async () => {
    crash.page = true
    const user = userEvent.setup()
    const router = renderAt('/users/octocat/repos/hello-world')

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Algo deu errado' })).toBeVisible()
    expect(within(alert).getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')

    const banner = screen.getByRole('banner')
    await user.type(
      within(banner).getByRole('textbox', { name: 'Nome de usuário do GitHub' }),
      'octocat{Enter}',
    )

    expect(router.state.location.pathname).toBe('/users/octocat')
    expect(await screen.findByRole('heading', { level: 1, name: /octocat/ })).toBeVisible()
    expect(fetchSpy).toHaveBeenCalledWith('https://api.github.com/users/octocat', expect.anything())
    expect(screen.queryByRole('heading', { name: 'Algo deu errado' })).not.toBeInTheDocument()
  })

  it('root error replaces a crashed header with a message and a link home', async () => {
    crash.header = true
    renderAt('/')

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Algo deu errado' })).toBeVisible()
    expect(within(alert).getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })

  it.each(errorScreens)('spacing on the %s screen', async (_name, part, path) => {
    crash[part] = true
    const { container } = renderAt(path)
    await screen.findByRole('alert')

    const rawClasses = usedClasses(container)
    const classes = withoutVariants(rawClasses)
    expect(usesToken(classes, ['bg', 'text', 'border'], tokensOf('color')), 'color').toBe(true)
    expect(usesToken(classes, ['text'], tokensOf('text')), 'typography').toBe(true)
    const { spacing, offScale } = await spacingReport(rawClasses)
    expect(spacing.length, 'spacing').toBeGreaterThan(0)
    expect(offScale, 'spacing off the DESIGN.md scale').toEqual([])
  })

  // The ring comes from the global :focus-visible rule in src/index.css (proven in the browser
  // by tests/app-shell.spec.ts); these screens cannot be crashed in the preview build, so this
  // proves no focusable on them opts out of that rule.
  it.each(errorScreens)('focus ring rule reaches every focusable, in header-first order, on the %s screen', async (_name, part, path) => {
    crash[part] = true
    const { container } = renderAt(path)
    await screen.findByRole('alert')

    const focusables = [...container.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
    expect(focusables.length).toBeGreaterThan(0)
    for (const element of focusables) {
      const overrides = [...element.classList].filter((name) =>
        /(^|:)(outline|ring)(-|$)|(^|:)focus(-visible|-within)?:/.test(name),
      )
      expect(overrides, element.outerHTML).toEqual([])
      // 0, never positive: a positive tabindex would jump ahead of the header.
      expect(element.tabIndex, element.outerHTML).toBe(0)
    }

    // Tab follows document order, so header focusables must precede the error's own.
    const alertFocusables = focusables.filter((element) => element.closest('[role="alert"]'))
    expect(alertFocusables.length).toBeGreaterThan(0)
    const banner = container.querySelector('header')
    if (part === 'page') expect(banner).not.toBeNull()
    for (const headerElement of banner ? focusables.filter((element) => banner.contains(element)) : []) {
      for (const errorElement of alertFocusables) {
        expect(
          headerElement.compareDocumentPosition(errorElement) & Node.DOCUMENT_POSITION_FOLLOWING,
          errorElement.outerHTML,
        ).toBeTruthy()
      }
    }
  })
})
