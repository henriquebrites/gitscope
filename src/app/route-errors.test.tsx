import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  // React and the router report caught render errors on the console.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  crash.page = false
  crash.header = false
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
    expect(screen.queryByRole('heading', { name: 'Algo deu errado' })).not.toBeInTheDocument()
  })

  it('root error replaces a crashed header with a message and a link home', async () => {
    crash.header = true
    renderAt('/')

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Algo deu errado' })).toBeVisible()
    expect(within(alert).getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })
})
