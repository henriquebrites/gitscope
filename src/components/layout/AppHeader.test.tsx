import { render, screen, waitFor } from '@testing-library/react'
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
    const router = renderHeader('/')

    await user.type(field(), 'typed')
    await router.navigate('/foo')

    await waitFor(() => expect(router.state.location.pathname).toBe('/foo'))
    await waitFor(() => expect(field()).toHaveValue(''))
  })

  it('passes the shared loading state to the form', () => {
    renderHeader('/users/octocat', true)

    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()
  })

  it('links the wordmark to the home page', () => {
    renderHeader('/users/octocat')

    expect(screen.getByRole('link', { name: 'GitHub Explorer' })).toHaveAttribute('href', '/')
  })
})
