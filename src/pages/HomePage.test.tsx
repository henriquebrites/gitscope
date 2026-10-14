import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GitHubContext } from '../context/GitHubContext'
import { initialGitHubState } from '../context/githubReducer'
import HomePage from './HomePage'

function renderHome() {
  return render(
    <GitHubContext value={{ state: initialGitHubState, dispatch: vi.fn() }}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </GitHubContext>,
  )
}

describe('HomePage', () => {
  it('hero copy: title, subtitle and a decorative glow behind the title only', () => {
    renderHome()

    const title = screen.getByRole('heading', { level: 1, name: 'Qualquer perfil do GitHub, em um só lugar.' })
    expect(title).toBeVisible()
    expect(
      screen.getByText('Perfil público, todos os repositórios ordenados e o README de cada projeto.'),
    ).toBeVisible()
    const glow = screen.getByTestId('hero-glow')
    expect(glow).toHaveAttribute('aria-hidden', 'true')
    expect(glow.textContent).toBe('')
    // Its box is the title's wrapper, so it sits behind no other text.
    expect(glow.parentElement).toBe(title.parentElement)
    expect(glow.parentElement?.children).toHaveLength(2)
  })

  it('examples: three links under "Experimente", each with its avatar and login', () => {
    renderHome()

    const list = screen.getByRole('list', { name: 'Experimente' })
    const links = within(list).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['octocat', '/users/octocat'],
      ['torvalds', '/users/torvalds'],
      ['gaearon', '/users/gaearon'],
    ])
    for (const link of links) {
      const avatar = link.querySelector('img')
      expect(avatar).not.toBeNull()
      expect(avatar).toHaveAttribute('alt', '')
      expect(new URL(avatar!.getAttribute('src')!).hostname).toBe('avatars.githubusercontent.com')
      expect(link).toHaveAccessibleName(link.textContent!)
    }
  })

  it('examples: a broken avatar leaves the link named by its login', () => {
    renderHome()

    const link = screen.getByRole('link', { name: 'gaearon' })
    fireEvent.error(link.querySelector('img')!)
    expect(link).toHaveAccessibleName('gaearon')
  })
})
