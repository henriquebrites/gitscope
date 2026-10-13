import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { GitHubError } from '../../services/githubApi'
import ProfileError from './ProfileError'

function renderError(error: GitHubError, login = 'ghost') {
  const onRetry = vi.fn()
  render(
    <MemoryRouter>
      <ProfileError error={error} login={login} onRetry={onRetry} />
    </MemoryRouter>,
  )
  return { onRetry, alert: screen.getByRole('alert') }
}

describe('ProfileError', () => {
  it('not-found names the login and links home', () => {
    const { alert } = renderError({ kind: 'not-found' }, 'ghost-user')

    expect(within(alert).getByRole('heading', { name: 'Conta não encontrada' })).toBeVisible()
    expect(alert).toHaveTextContent('ghost-user')
    expect(within(alert).getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
    ['click', async (button: HTMLElement) => userEvent.setup().click(button)],
    ['Enter', async (button: HTMLElement) => { button.focus(); await userEvent.setup().keyboard('{Enter}') }],
    ['Space', async (button: HTMLElement) => { button.focus(); await userEvent.setup().keyboard(' ') }],
  ])('network offers a retry that works by %s', async (_trigger, activate) => {
    const { alert, onRetry } = renderError({ kind: 'network' })

    expect(alert).toHaveTextContent('Não foi possível conectar ao GitHub.')
    const button = within(alert).getByRole('button', { name: 'Tentar novamente' })
    expect(onRetry).not.toHaveBeenCalled()
    await activate(button)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('rate-limited explains the limit and shows the release time', () => {
    const { alert } = renderError({ kind: 'rate-limited', resetAt: new Date(2026, 9, 12, 14, 5) })

    expect(alert).toHaveTextContent('O GitHub limitou temporariamente as consultas')
    expect(alert).toHaveTextContent('14:05')
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  it('rate-limited without a reset time shows no time', () => {
    const { alert } = renderError({ kind: 'rate-limited' })

    expect(alert).toHaveTextContent('O GitHub limitou temporariamente as consultas')
    expect(alert.textContent).not.toMatch(/\d{2}:\d{2}/)
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  it('unexpected shows a generic message with retry and no status code', async () => {
    const { alert, onRetry } = renderError({ kind: 'unexpected', status: 503 })

    expect(within(alert).getByRole('heading', { name: 'Algo deu errado' })).toBeVisible()
    expect(alert.textContent).not.toContain('503')
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it.each([
    [{ kind: 'not-found' }, 'Conta não encontrada'],
    [{ kind: 'network' }, 'Sem conexão'],
    [{ kind: 'rate-limited' }, 'Limite de consultas atingido'],
    [{ kind: 'unexpected' }, 'Algo deu errado'],
  ] satisfies [GitHubError, string][])('titles are level-1 headings: %o', (error, title) => {
    const { alert } = renderError(error)

    expect(within(alert).getByRole('heading', { level: 1, name: title })).toBeVisible()
  })
})
