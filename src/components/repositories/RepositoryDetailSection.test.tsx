import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { RepositoryResult } from '../../hooks/useRepository'
import type { GitHubError } from '../../services/githubApi'
import { usedClasses, usesToken, withoutVariants } from '../../test/classes'
import { helloWorld } from '../../test/github'
import { spacingReport } from '../../test/spacing'
import { tokensOf } from '../../test/theme'
import { formatTime } from '../../utils/formatters'
import RepositoryDetailSection from './RepositoryDetailSection'

function renderSection(result: RepositoryResult, onRetry: () => void = () => {}) {
  const view = render(
    <MemoryRouter>
      <RepositoryDetailSection result={result} login="octocat" onRetry={onRetry} />
    </MemoryRouter>,
  )
  return { ...view, section: screen.getByRole('region', { name: 'Repositório' }) }
}

function liveRegion(section: HTMLElement) {
  const region = section.querySelector('[aria-live]')
  expect(region).not.toBeNull()
  return region as HTMLElement
}

/** The `<dd>` paired with the `<dt>` that reads `term`. */
function valueOf(section: HTMLElement, term: string) {
  const dt = within(section).getByText(term, { selector: 'dt' })
  return dt.nextElementSibling as HTMLElement
}

const resetAt = new Date(2026, 9, 12, 14, 5)

const errors: [string, GitHubError, string][] = [
  ['not-found', { kind: 'not-found' }, 'Repositório não encontrado'],
  ['network', { kind: 'network' }, 'Sem conexão'],
  ['rate-limited', { kind: 'rate-limited', resetAt }, 'Limite de consultas atingido'],
  ['unexpected', { kind: 'unexpected', status: 500 }, 'Algo deu errado'],
]

const states: [string, RepositoryResult][] = [
  ['loading', { status: 'loading' }],
  ['success', { status: 'success', repository: helloWorld }],
  ['null fields', { status: 'success', repository: { ...helloWorld, description: null, language: null } }],
  ...errors.map(([name, error]): [string, RepositoryResult] => [name, { status: 'error', error }]),
]

describe('RepositoryDetailSection', () => {
  it('loading shows the skeleton in the detail area and announces it politely', () => {
    const { section } = renderSection({ status: 'loading' })

    expect(within(section).getByTestId('repository-skeleton')).toBeInTheDocument()
    const region = liveRegion(section)
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('Carregando repositório…')
    expect(within(section).queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('success shows name, description, stars in pt-BR, language and the external link', () => {
    const { section } = renderSection({ status: 'success', repository: helloWorld })

    expect(within(section).getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
    expect(within(section).getByText('My first repository on GitHub!')).toBeVisible()
    expect(valueOf(section, 'Estrelas')).toHaveTextContent(/^12\.345$/)
    expect(valueOf(section, 'Linguagem')).toHaveTextContent(/^TypeScript$/)
    const link = within(section).getByRole('link', {
      name: 'Ver repositório no GitHub (abre em nova aba)',
    })
    expect(link).toHaveAttribute('href', 'https://github.com/octocat/Hello-World')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(liveRegion(section)).toHaveTextContent(/^$/)
    expect(within(section).queryByTestId('repository-skeleton')).not.toBeInTheDocument()
  })

  it('null fields: description replaced, language omitted, never null or undefined', () => {
    const { section, container } = renderSection({
      status: 'success',
      repository: { ...helloWorld, description: null, language: null },
    })

    expect(within(section).getByText('Sem descrição.')).toBeVisible()
    expect(within(section).queryByText('Linguagem')).not.toBeInTheDocument()
    expect(valueOf(section, 'Estrelas')).toHaveTextContent(/^12\.345$/)
    expect(container.textContent).not.toMatch(/null|undefined/)
  })

  it('not-found shows the title and a link back to the profile', () => {
    const { section } = renderSection({ status: 'error', error: { kind: 'not-found' } })

    const alert = within(section).getByRole('alert')
    expect(within(alert).getByRole('heading', { level: 1, name: 'Repositório não encontrado' })).toBeVisible()
    expect(within(alert).getByRole('link', { name: 'Voltar ao perfil de octocat' })).toHaveAttribute(
      'href',
      '/users/octocat',
    )
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  describe('request errors', () => {
    it.each(['click', 'Enter', 'Space'])('network: message and retry by %s', async (how) => {
      const onRetry = vi.fn()
      const { section } = renderSection({ status: 'error', error: { kind: 'network' } }, onRetry)

      const alert = within(section).getByRole('alert')
      expect(within(alert).getByRole('heading', { level: 1, name: 'Sem conexão' })).toBeVisible()
      expect(alert).toHaveTextContent('Não foi possível conectar ao GitHub.')
      const button = within(alert).getByRole('button', { name: 'Tentar novamente' })
      const user = userEvent.setup()
      if (how === 'click') await user.click(button)
      else {
        button.focus()
        await user.keyboard(how === 'Enter' ? '{Enter}' : ' ')
      }
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('rate-limited with a reset time: explanation and HH:mm, no button', () => {
      const { section } = renderSection({ status: 'error', error: { kind: 'rate-limited', resetAt } })

      const alert = within(section).getByRole('alert')
      expect(within(alert).getByRole('heading', { level: 1, name: 'Limite de consultas atingido' })).toBeVisible()
      expect(alert).toHaveTextContent('O GitHub limitou temporariamente as consultas feitas a partir desta rede.')
      expect(formatTime(resetAt)).toBe('14:05')
      expect(alert).toHaveTextContent('As consultas voltam a ser liberadas às 14:05.')
      expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
    })

    it('rate-limited without a reset time: try later, no button', () => {
      const { section } = renderSection({ status: 'error', error: { kind: 'rate-limited' } })

      const alert = within(section).getByRole('alert')
      expect(alert).toHaveTextContent('O GitHub limitou temporariamente as consultas feitas a partir desta rede.')
      expect(alert).toHaveTextContent('Tente de novo mais tarde.')
      expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
    })

    it('unexpected: generic message and retry', async () => {
      const onRetry = vi.fn()
      const { section } = renderSection({ status: 'error', error: { kind: 'unexpected', status: 500 } }, onRetry)

      const alert = within(section).getByRole('alert')
      expect(within(alert).getByRole('heading', { level: 1, name: 'Algo deu errado' })).toBeVisible()
      expect(alert).toHaveTextContent('Não foi possível carregar este repositório agora.')
      await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it.each(errors)('%s stays in the detail area, without skeleton or loading text', (_kind, error, title) => {
      const { section } = renderSection({ status: 'error', error })

      expect(within(within(section).getByRole('alert')).getByRole('heading', { name: title })).toBeVisible()
      expect(within(section).queryByTestId('repository-skeleton')).not.toBeInTheDocument()
      expect(liveRegion(section)).toHaveTextContent(/^$/)
    })
  })

  it.each(states)('tokens only in the %s state', async (_name, result) => {
    const { container } = renderSection(result)
    const rawClasses = usedClasses(container)
    const classes = withoutVariants(rawClasses)

    expect(usesToken(classes, ['bg', 'text', 'border'], tokensOf('color')), 'color').toBe(true)
    expect(usesToken(classes, ['text'], tokensOf('text')), 'typography').toBe(true)
    const stockTypography = classes.filter((name) =>
      /^(?:text-(?:xs|sm|base|lg|[2-9]?xl|\[)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[)|tracking-|leading-)/.test(name),
    )
    expect(stockTypography, 'typography off the DESIGN.md tokens').toEqual([])
    const { spacing, offScale } = await spacingReport(rawClasses)
    expect(spacing.length, 'spacing').toBeGreaterThan(0)
    expect(offScale, 'spacing off the DESIGN.md scale').toEqual([])
  })
})
