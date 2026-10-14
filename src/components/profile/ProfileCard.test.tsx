import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { octocat } from '../../test/github'
import ProfileCard from './ProfileCard'

function tiles() {
  return screen.getAllByTestId('profile-tile').map((tile) => [
    within(tile).getByRole('term').textContent,
    within(tile).getByRole('definition').textContent,
  ])
}

describe('ProfileCard', () => {
  it('complete profile: cover, avatar after it, identity, bio, three tiles and links', () => {
    const { container } = render(<ProfileCard profile={{ ...octocat, followers: 12345, following: 7, public_repos: 8 }} />)

    const cover = screen.getByTestId('profile-cover')
    expect(cover).toHaveAttribute('aria-hidden', 'true')
    expect(cover).toHaveClass('gradient-vitrine')
    expect(container.querySelector('article')?.firstElementChild).toBe(cover)
    const avatar = screen.getByRole('img', { name: 'Avatar de octocat' })
    expect(avatar).toHaveAttribute('src', octocat.avatar_url)
    // Pulled up over the cover's lower edge.
    expect(avatar).toHaveClass('-mt-10')
    expect(screen.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
    expect(screen.getByText('The Octocat')).toBeVisible()
    expect(tiles()).toEqual([
      ['Seguidores', '12.345'],
      ['Seguindo', '7'],
      ['Repositórios', '8'],
    ])
    expect(screen.getByText('Mascote do GitHub.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'octocat@github.com' })).toHaveAttribute(
      'href',
      'mailto:octocat@github.com',
    )
    const external = screen.getByRole('link', { name: 'Ver perfil no GitHub (abre em nova aba)' })
    expect(external).toHaveAttribute('href', 'https://github.com/octocat')
    expect(external).toHaveAttribute('target', '_blank')
    expect(external).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('null fields: omits name and e-mail, says "Sem bio.", keeps cover, avatar and tiles', () => {
    const { container } = render(
      <ProfileCard profile={{ ...octocat, name: null, bio: null, email: null }} />,
    )

    expect(screen.queryByText('The Octocat')).not.toBeInTheDocument()
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(screen.getByText('Sem bio.')).toBeVisible()
    expect(screen.getByTestId('profile-cover')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Avatar de octocat' })).toBeVisible()
    expect(tiles().map(([label]) => label)).toEqual(['Seguidores', 'Seguindo', 'Repositórios'])
    expect(container.textContent).not.toMatch(/null|undefined/)
    const attributes = [container, ...container.querySelectorAll('*')].flatMap((element) =>
      [...element.attributes].map((attribute) => attribute.value),
    )
    expect(attributes.filter((value) => /null|undefined/.test(value))).toEqual([])
  })
})
