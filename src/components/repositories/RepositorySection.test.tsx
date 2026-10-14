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
    expect(within(section).queryByRole('radiogroup')).not.toBeInTheDocument()
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

  const sortLabels: [SortKey, string][] = [
    ['stars-desc', 'Mais estrelas'],
    ['stars-asc', 'Menos estrelas'],
    ['name-asc', 'Nome'],
    ['updated-desc', 'Atualização'],
  ]

  it.each(sortLabels)('sort pills: one-choice group "Ordenar por", %s checks "%s"', (sort, label) => {
    const { section } = renderSection(success(3), { sort })

    const group = within(section).getByRole('radiogroup', { name: 'Ordenar por' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual(sortLabels.map(([, name]) => name))
    expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual(sortLabels.map(([key]) => key))
    expect(new Set(radios.map((radio) => (radio as HTMLInputElement).name)).size).toBe(1)
    expect(radios.filter((radio) => (radio as HTMLInputElement).checked)).toEqual([
      within(group).getByRole('radio', { name: label }),
    ])
  })

  it.each(sortLabels)('sort pills report the chosen key: %s by click', async (sort, label) => {
    const other = sort === 'stars-desc' ? 'stars-asc' : 'stars-desc'
    const { section, onSortChange } = renderSection(success(3), { sort: other })

    await userEvent.setup().click(within(section).getByRole('radio', { name: label }))

    expect(onSortChange).toHaveBeenCalledWith(sort)
  })

  it('sort pills: the arrow keys move the choice', async () => {
    const { section, onSortChange } = renderSection(success(3), { sort: 'stars-desc' })
    const user = userEvent.setup()

    within(section).getByRole('radio', { name: 'Mais estrelas' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onSortChange).toHaveBeenLastCalledWith('stars-asc')
  })

  it('shows 30 items of the requested page', () => {
    const { section } = renderSection(success(45), { sort: 'name-asc', pageParam: '2' })

    const items = within(section).getAllByRole('listitem')
    expect(items).toHaveLength(15)
    expect(items[0]).toHaveTextContent('repo-031')
  })

  /** The numbered pager as it reads: numbers, `…` for gaps. */
  function pagerSequence(pager: HTMLElement) {
    return [...within(pager).getByTestId('pager-numbers').children].map((child) => child.textContent)
  }

  it.each<[number, string[]]>([
    [5, ['1', '…', '4', '5', '6', '…', '10']],
    [1, ['1', '2', '…', '10']],
    [3, ['1', '2', '3', '4', '…', '10']],
  ])('numbered pager: page %i of 10', (page, sequence) => {
    const { section } = renderSection(success(300), { pageParam: String(page) })

    const pager = within(section).getByRole('navigation', { name: 'Páginas de repositórios' })
    const parts = [...pager.children].map((child) => child.textContent)
    expect(parts[0]).toBe('Anterior')
    expect(parts.at(-1)).toBe('Próxima')
    expect(pagerSequence(pager)).toEqual(sequence)
    const current = within(pager).getByRole('button', { name: `Página ${page}` })
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(pager.querySelectorAll('[aria-current]')).toHaveLength(1)
    // Gaps are text, never a stop of the Tab key.
    for (const gap of within(pager).getAllByText('…')) {
      expect(gap.tagName).toBe('SPAN')
      expect(gap).not.toHaveAttribute('tabindex')
      expect(gap).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('numbered pager: a number reports its page', async () => {
    const { section, onPageChange } = renderSection(success(300), { pageParam: '5' })

    await userEvent.setup().click(within(section).getByRole('button', { name: 'Página 6' }))
    expect(onPageChange).toHaveBeenCalledWith(6)
    await userEvent.setup().click(within(section).getByRole('button', { name: 'Página 10' }))
    expect(onPageChange).toHaveBeenLastCalledWith(10)
  })

  it('compact pager reads "p de N"', () => {
    const { section } = renderSection(success(300), { pageParam: '3' })

    expect(within(section).getByTestId('pager-compact')).toHaveTextContent(/^3 de 10$/)
  })

  it('pager on the first page: Anterior disabled, current page marked', async () => {
    const { section, onPageChange } = renderSection(success(45))

    const pager = within(section).getByRole('navigation', { name: 'Páginas de repositórios' })
    expect(within(pager).getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(within(pager).getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    const next = within(pager).getByRole('button', { name: 'Próxima' })
    expect(next).toBeEnabled()

    await userEvent.setup().click(next)
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('pager on the last page: Próxima disabled, Anterior works by Enter', async () => {
    const { section, onPageChange } = renderSection(success(45), { pageParam: '2' })

    const pager = within(section).getByRole('navigation', { name: 'Páginas de repositórios' })
    expect(within(pager).getByRole('button', { name: 'Próxima' })).toBeDisabled()
    expect(within(pager).getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    within(pager).getByRole('button', { name: 'Anterior' }).focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('single page: no pager', () => {
    const { section } = renderSection(success(30))

    expect(within(section).getAllByRole('listitem')).toHaveLength(30)
    expect(within(section).queryByRole('navigation')).not.toBeInTheDocument()
    expect(within(section).queryByTestId('pager-compact')).not.toBeInTheDocument()
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
