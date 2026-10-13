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
  it('shows name, description, stars in pt-BR, language and update date', () => {
    const { item } = renderItem('hello-world', {
      description: 'Meu primeiro repositório.',
      stargazers_count: 12345,
      language: 'TypeScript',
      updated_at: '2026-03-05T12:00:00Z',
    })

    expect(within(item).getByRole('link', { name: 'hello-world' })).toHaveAttribute(
      'href',
      '/users/octocat/repos/hello-world',
    )
    expect(item).toHaveTextContent('Meu primeiro repositório.')
    expect(within(item).getByText('Estrelas').nextElementSibling).toHaveTextContent(/^12\.345$/)
    expect(within(item).getByText('Linguagem').nextElementSibling).toHaveTextContent(/^TypeScript$/)
    expect(within(item).getByText('Atualizado em').nextElementSibling).toHaveTextContent(/^05\/03\/2026$/)
  })

  it('omits a null description and language, never printing null or undefined', () => {
    const { item, container } = renderItem('bare', { description: null, language: null })

    expect(within(item).queryByText(/^Description of/)).not.toBeInTheDocument()
    expect(within(item).queryByText('Linguagem')).not.toBeInTheDocument()
    expect(item.querySelectorAll('p')).toHaveLength(0)
    expect(container.textContent).not.toMatch(/null|undefined/)
    const attributes = [container, ...container.querySelectorAll('*')].flatMap((element) =>
      [...element.attributes].map((attribute) => attribute.value),
    )
    expect(attributes.filter((value) => /null|undefined/.test(value))).toEqual([])
  })

  it('encodes the repository name in the detail link', () => {
    const { item } = renderItem('a b#c')

    expect(within(item).getByRole('link', { name: 'a b#c' })).toHaveAttribute(
      'href',
      '/users/octocat/repos/a%20b%23c',
    )
  })
})
