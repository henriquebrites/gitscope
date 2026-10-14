import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GitHubContext } from '../../context/GitHubContext'
import { initialGitHubState, type GitHubState } from '../../context/githubReducer'
import AppHeader from './AppHeader'

// A stub route tree, so only the header's own decisions are under test.
function renderHeader(path: string, isProfileLoading = false) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <AppHeader />
            <Outlet />
          </>
        ),
        children: [{ path: '*', element: null }],
      },
    ],
    { initialEntries: [path] },
  )
  const state: GitHubState = {
    ...initialGitHubState,
    profileRequest: isProfileLoading ? { key: 'octocat', status: 'loading' } : null,
  }
  render(
    <GitHubContext value={{ state, dispatch: vi.fn() }}>
      <RouterProvider router={router} />
    </GitHubContext>,
  )
  return router
}

const field = () => screen.getByRole('textbox', { name: 'Nome de usuário do GitHub' })

describe('AppHeader', () => {
  it('builds the profile URL from the trimmed, encoded login and drops the query', async () => {
    const user = userEvent.setup()
    const router = renderHeader('/users/x?sort=name-asc&page=2')

    await user.type(field(), '  a b/c?d#e  {Enter}')

    expect(router.state.location.pathname).toBe('/users/a%20b%2Fc%3Fd%23e')
    expect(router.state.location.search).toBe('')
    expect(router.state.location.hash).toBe('')
  })

  it('clears the field when the location changes', async () => {
    const user = userEvent.setup()
    const router = renderHeader('/foo')

    await user.type(field(), 'typed')
    await router.navigate('/bar')

    await waitFor(() => expect(router.state.location.pathname).toBe('/bar'))
    await waitFor(() => expect(field()).toHaveValue(''))
  })

  it('passes the shared loading state to the form', () => {
    renderHeader('/users/octocat', true)

    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()
  })

  it('no search on the home route: wordmark and theme only', () => {
    renderHeader('/')

    const banner = screen.getByRole('banner')
    expect(within(banner).queryByRole('search')).not.toBeInTheDocument()
    expect(within(banner).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: 'GitHub Explorer' })).toHaveAttribute('href', '/')
    expect(within(banner).getAllByRole('button')).toHaveLength(1)
    expect(within(banner).getByRole('button', { name: 'Usar tema escuro' })).toBeInTheDocument()
  })

  it('other routes: search between two theme placements, one per layout', () => {
    renderHeader('/users/octocat')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('search')).toBeInTheDocument()
    const toggles = within(banner).getAllByRole('button', { name: 'Usar tema escuro' })
    expect(toggles).toHaveLength(2)
    expect(toggles[0]).toHaveClass('sm:hidden')
    expect(toggles[1]).toHaveClass('hidden', 'sm:inline-flex')
    const search = within(banner).getByRole('search')
    expect(toggles[0].compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(search.compareDocumentPosition(toggles[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('links the wordmark to the home page', () => {
    renderHeader('/users/octocat')

    expect(screen.getByRole('link', { name: 'GitHub Explorer' })).toHaveAttribute('href', '/')
  })
})
