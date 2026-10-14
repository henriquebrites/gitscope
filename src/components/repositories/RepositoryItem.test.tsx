import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { repositoryOf } from '../../test/github'
import RepositoryItem from './RepositoryItem'

function renderItem(...args: Parameters<typeof repositoryOf>) {
  const view = render(
    <MemoryRouter>
      <ul>
        <RepositoryItem repository={repositoryOf(...args)} login="octocat" />
      </ul>
    </MemoryRouter>,
  )
  return { ...view, item: screen.getByRole('listitem') }
}

describe('RepositoryItem', () => {
  it('shows name, stars pill, description, language and update date', () => {
    const { item } = renderItem('hello-world', {
      description: 'Meu primeiro repositório.',
      stargazers_count: 2814,
      language: 'TypeScript',
      updated_at: '2026-03-05T12:00:00Z',
    })

    const link = within(item).getByRole('link', { name: 'hello-world' })
    expect(link).toHaveAttribute('href', '/users/octocat/repos/hello-world')
    // The link's overlay covers the card, which is the positioned box.
    expect(link).toHaveClass('after:absolute', 'after:inset-0')
    expect(item).toHaveClass('relative')
    const stars = within(item).getByTestId('repository-stars')
    expect(stars).toHaveTextContent(/^★ 2\.814 estrelas$/)
    expect(stars).toHaveClass('rounded-pill')
    // In the top row, beside the name.
    expect(stars.parentElement).toBe(link.closest('h3')?.parentElement)
    expect(within(item).getByText('Meu primeiro repositório.')).toBeVisible()
    expect(within(item).getByText('TypeScript')).toBeVisible()
    const dot = within(item).getByTestId('language-dot')
    expect(dot).toHaveAttribute('aria-hidden', 'true')
    expect(dot).toHaveStyle({ backgroundColor: '#3178c6' })
    expect(within(item).getByText('Atualizado em 05/03/2026')).toBeVisible()
  })

  it('null description reads "Sem descrição."; null language omits dot and name', () => {
    const { item, container } = renderItem('bare', { description: null, language: null })

    expect(within(item).getByText('Sem descrição.')).toBeVisible()
    expect(within(item).queryByTestId('language-dot')).not.toBeInTheDocument()
    expect(within(item).queryByText('TypeScript')).not.toBeInTheDocument()
    expect(within(item).getByText(/^Atualizado em \d{2}\/\d{2}\/\d{4}$/)).toBeVisible()
    expect(container.textContent).not.toMatch(/null|undefined/)
    const attributes = [container, ...container.querySelectorAll('*')].flatMap((element) =>
      [...element.attributes].map((attribute) => attribute.value),
    )
    expect(attributes.filter((value) => /null|undefined/.test(value))).toEqual([])
  })

  it('unknown language: neutral dot, name still shown', () => {
    const { item } = renderItem('esoteric', { language: 'Brainfuck' })

    expect(within(item).getByText('Brainfuck')).toBeVisible()
    const dot = within(item).getByTestId('language-dot')
    expect(dot).toHaveClass('bg-mute')
    expect(dot.style.backgroundColor).toBe('')
  })

  it('encodes the repository name in the detail link', () => {
    const { item } = renderItem('a b#c')

    expect(within(item).getByRole('link', { name: 'a b#c' })).toHaveAttribute(
      'href',
      '/users/octocat/repos/a%20b%23c',
    )
  })
})
