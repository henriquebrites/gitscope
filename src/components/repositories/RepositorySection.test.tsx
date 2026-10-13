import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { RepositoriesResult } from '../../hooks/useRepositories'
import type { GitHubError } from '../../services/githubApi'
import { usedClasses, usesToken, withoutVariants } from '../../test/classes'
import { repositoriesOf, repositoryOf } from '../../test/github'
import { spacingReport } from '../../test/spacing'
import { tokensOf } from '../../test/theme'
import type { SortKey } from '../../types/github'
import RepositorySection from './RepositorySection'

interface Options {
  sort?: SortKey
  pageParam?: string | null
}

function renderSection(result: RepositoriesResult, { sort = 'stars-desc', pageParam = null }: Options = {}) {
  const handlers = { onSortChange: vi.fn(), onPageChange: vi.fn(), onRetry: vi.fn() }
  const view = render(
    <MemoryRouter>
      <RepositorySection result={result} login="octocat" sort={sort} pageParam={pageParam} {...handlers} />
    </MemoryRouter>,
  )
  return { ...view, ...handlers, section: screen.getByRole('region', { name: 'Repositórios' }) }
}

const success = (count: number): RepositoriesResult => ({
  status: 'success',
  repositories: repositoriesOf('repo', count),
})

function liveRegion(section: HTMLElement) {
  const region = section.querySelector('[aria-live]')
  expect(region).not.toBeNull()
  return region as HTMLElement
}

const errors: [string, GitHubError, string, string, boolean][] = [
  ['network', { kind: 'network' }, 'Sem conexão', 'Não foi possível conectar ao GitHub.', true],
  [
    'rate-limited',
    { kind: 'rate-limited', resetAt: new Date(2026, 9, 12, 14, 5) },
    'Limite de consultas atingido',
    'O GitHub limitou temporariamente as consultas',
    false,
  ],
  ['unexpected', { kind: 'unexpected', status: 500 }, 'Algo deu errado', 'Não foi possível carregar os repositórios agora.', true],
  ['not-found', { kind: 'not-found' }, 'Algo deu errado', 'Não foi possível carregar os repositórios agora.', true],
]

const states: [string, RepositoriesResult][] = [
  ['loading', { status: 'loading', page: 2 }],
  ['list with pages', success(45)],
  ['empty', success(0)],
  ...errors.map(([name, error]): [string, RepositoriesResult] => [name, { status: 'error', error }]),
]

describe('RepositorySection', () => {
  it('loading announces the page in progress politely and shows no item', () => {
    const { section } = renderSection({ status: 'loading', page: 3 })

    const region = liveRegion(section)
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent(/^Carregando repositórios… \(página 3\)$/)
    expect(region).not.toHaveClass('sr-only')
    expect(within(section).queryByRole('list')).not.toBeInTheDocument()
    expect(within(section).queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('outside loading the live region is empty', () => {
    const { section } = renderSection(success(3))

    expect(liveRegion(section)).toHaveTextContent(/^$/)
  })

  it.each(errors)('error %s: message in an alert, no item', async (_kind, error, title, text, retry) => {
    const { section, onRetry } = renderSection({ status: 'error', error })

    const alert = within(section).getByRole('alert')
    expect(within(alert).getByRole('heading', { name: title })).toBeVisible()
    expect(alert).toHaveTextContent(text)
    expect(within(section).queryByRole('list')).not.toBeInTheDocument()
    expect(liveRegion(section)).toHaveTextContent(/^$/)
    if (retry) {
      await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    } else {
      expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
    }
  })

  it.each(errors)('error titles are level-3 headings: %s', (_kind, error, title) => {
    const { section } = renderSection({ status: 'error', error })

    expect(within(within(section).getByRole('alert')).getByRole('heading', { level: 3, name: title })).toBeVisible()
  })

  it('error rate-limited shows the release time', () => {
    const { section } = renderSection({
      status: 'error',
      error: { kind: 'rate-limited', resetAt: new Date(2026, 9, 12, 14, 5) },
    })

    expect(within(section).getByRole('alert')).toHaveTextContent('14:05')
  })

  it('error retry works by Enter', async () => {
    const { section, onRetry } = renderSection({ status: 'error', error: { kind: 'network' } })

    within(section).getByRole('button', { name: 'Tentar novamente' }).focus()
    await userEvent.setup().keyboard('{Enter}')

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('empty: informative message, not an error', () => {
    const { section, container } = renderSection(success(0))

    const message = within(section).getByText('Esta conta não tem repositórios públicos.')
    expect(message).toBeVisible()
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
    expect(message).not.toHaveClass('text-error')
    expect(withoutVariants(usedClasses(container)).filter((name) => name.includes('error'))).toEqual([])
    expect(within(section).queryByRole('list')).not.toBeInTheDocument()
  })

  it('sort control: visible label, the four options in order, the current one selected', () => {
    const { section } = renderSection(success(3), { sort: 'updated-desc' })

    const select = within(section).getByRole('combobox', { name: 'Ordenar por' })
    expect(select.tagName).toBe('SELECT')
    expect(within(section).getByText('Ordenar por').tagName).toBe('LABEL')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Estrelas — maior para menor',
      'Estrelas — menor para maior',
      'Nome — A a Z',
      'Atualização — mais recente',
    ])
    expect(within(select).getByRole('option', { name: 'Atualização — mais recente' })).toHaveProperty(
      'selected',
      true,
    )
  })

  it('sort control reports the chosen key', async () => {
    const { section, onSortChange } = renderSection(success(3))

    await userEvent
      .setup()
      .selectOptions(within(section).getByRole('combobox', { name: 'Ordenar por' }), 'Nome — A a Z')

    expect(onSortChange).toHaveBeenCalledWith('name-asc')
  })

  it('shows 30 items of the requested page', () => {
    const { section } = renderSection(success(45), { sort: 'name-asc', pageParam: '2' })

    const items = within(section).getAllByRole('listitem')
    expect(items).toHaveLength(15)
    expect(items[0]).toHaveTextContent('repo-031')
  })

  it('pager on the first page: Anterior disabled, current page marked', async () => {
    const { section, onPageChange } = renderSection(success(45))

    const pager = within(section).getByRole('navigation', { name: 'Páginas de repositórios' })
    expect(within(pager).getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(within(pager).getByText('Página 1 de 2')).toHaveAttribute('aria-current', 'page')
    const next = within(pager).getByRole('button', { name: 'Próxima' })
    expect(next).toBeEnabled()

    await userEvent.setup().click(next)
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('pager on the last page: Próxima disabled, Anterior works by Enter', async () => {
    const { section, onPageChange } = renderSection(success(45), { pageParam: '2' })

    const pager = within(section).getByRole('navigation', { name: 'Páginas de repositórios' })
    expect(within(pager).getByRole('button', { name: 'Próxima' })).toBeDisabled()
    expect(within(pager).getByText('Página 2 de 2')).toHaveAttribute('aria-current', 'page')

    within(pager).getByRole('button', { name: 'Anterior' }).focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('single page: no pager', () => {
    const { section } = renderSection(success(30))

    expect(within(section).getAllByRole('listitem')).toHaveLength(30)
    expect(within(section).queryByRole('navigation')).not.toBeInTheDocument()
    expect(within(section).queryByText(/^Página/)).not.toBeInTheDocument()
  })

  it('sorts the whole list before slicing the page', () => {
    const repositories = [...repositoriesOf('low', 40), repositoryOf('top', { stargazers_count: 99 })]
    const { section } = renderSection({ status: 'success', repositories })

    expect(within(section).getAllByRole('listitem')[0]).toHaveTextContent('top')
  })

  it.each(states)('spacing and tokens in the %s state', async (_name, result) => {
    const { container } = renderSection(result)
    const rawClasses = usedClasses(container)
    const classes = withoutVariants(rawClasses)

    expect(usesToken(classes, ['bg', 'text', 'border'], tokensOf('color')), 'color').toBe(true)
    expect(usesToken(classes, ['text'], tokensOf('text')), 'typography').toBe(true)
    // Colour comes only from DESIGN.md tokens: every bg-/text-/border- class that is not a
    // type size or a border width names a colour token.
    const colors = new Set(tokensOf('color'))
    const textSizes = new Set(tokensOf('text'))
    const offTokenColors = classes.filter((name) => {
      const match = /^(bg|text|border)-(.+)$/.exec(name)
      if (!match) return false
      const [, prefix, value] = match
      if (prefix === 'text' && (textSizes.has(value) || /^(?:left|center|right|justify|wrap|nowrap|balance|pretty|ellipsis|clip)$/.test(value))) return false
      if (prefix === 'border' && /^(?:[trblxyse]|[trblxyse]-\d+|\d+|solid|dashed|dotted|double|none|hidden)$/.test(value)) return false
      return !colors.has(value)
    })
    expect(offTokenColors, 'colour off the DESIGN.md tokens').toEqual([])
    // Typography comes only from DESIGN.md tokens, as in ProfileSection.
    const stockTypography = classes.filter((name) =>
      /^(?:text-(?:xs|sm|base|lg|[2-9]?xl|\[)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[)|tracking-|leading-)/.test(name),
    )
    expect(stockTypography, 'typography off the DESIGN.md tokens').toEqual([])
    const { spacing, offScale } = await spacingReport(rawClasses)
    expect(spacing.length, 'spacing').toBeGreaterThan(0)
    expect(offScale, 'spacing off the DESIGN.md scale').toEqual([])
  })
})
