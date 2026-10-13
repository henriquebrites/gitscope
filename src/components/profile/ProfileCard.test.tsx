import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { octocat } from '../../test/github'
import ProfileCard from './ProfileCard'

describe('ProfileCard', () => {
  it('shows every field of a complete profile', () => {
    render(<ProfileCard profile={octocat} />)

    expect(screen.getByRole('img', { name: 'Avatar de octocat' })).toHaveAttribute('src', octocat.avatar_url)
    expect(screen.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
    expect(screen.getByText('The Octocat')).toBeVisible()
    expect(screen.getByText('Seguidores').nextElementSibling).toHaveTextContent(/^12\.345$/)
    expect(screen.getByText('Seguindo').nextElementSibling).toHaveTextContent(/^7$/)
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

  it('handles null fields: omits name and e-mail, says "Sem bio."', () => {
    const { container } = render(
      <ProfileCard profile={{ ...octocat, name: null, bio: null, email: null }} />,
    )

    expect(screen.queryByText('The Octocat')).not.toBeInTheDocument()
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(screen.getByText('Sem bio.')).toBeVisible()
    expect(container.textContent).not.toMatch(/null|undefined/)
    const attributes = [container, ...container.querySelectorAll('*')].flatMap((element) =>
      [...element.attributes].map((attribute) => attribute.value),
    )
    expect(attributes.filter((value) => /null|undefined/.test(value))).toEqual([])
  })
})
