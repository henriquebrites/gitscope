import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReadmeResult } from '../../hooks/useReadme'
import { usedClasses, usesToken, withoutVariants } from '../../test/classes'
import { spacingReport } from '../../test/spacing'
import { tokensOf } from '../../test/theme'
import RepositoryReadme from './RepositoryReadme'

type Shown = Exclude<ReadmeResult, { status: 'idle' }>

function renderReadme(result: Shown) {
  const onRetry = vi.fn()
  const view = render(<RepositoryReadme result={result} onRetry={onRetry} />)
  return { ...view, onRetry, section: screen.getByRole('region', { name: 'README' }) }
}

function liveRegion(section: HTMLElement) {
  const region = section.querySelector('[aria-live]')
  expect(region).not.toBeNull()
  return region as HTMLElement
}

const readme = `<h1>Projeto</h1><p>Um parágrafo com <a href="https://example.com">link</a>.</p>
<ul><li>item</li></ul><ol><li>passo</li></ol><pre><code>npm install</code></pre>
<table><thead><tr><th>Coluna</th></tr></thead><tbody><tr><td>valor</td></tr></tbody></table>
<script>window.pwned = 1</script><img src="x" onerror="window.pwned = 2" alt="logo">`

const resetAt = new Date(2026, 9, 12, 14, 5)

describe('RepositoryReadme', () => {
  it('loading: titled section, hidden skeleton, polite announcement', () => {
    const { section } = renderReadme({ status: 'loading' })

    expect(within(section).getByRole('heading', { level: 2, name: 'README' })).toBeVisible()
    expect(within(section).getByTestId('readme-skeleton')).toHaveAttribute('aria-hidden', 'true')
    const region = liveRegion(section)
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent(/^Carregando README…$/)
    expect(within(section).queryByTestId('readme-content')).not.toBeInTheDocument()
  })

  it('loaded: the sanitized HTML with headings, paragraphs, lists, code and tables', () => {
    const { section } = renderReadme({ status: 'success', html: readme })

    const content = within(section).getByTestId('readme-content')
    expect(within(content).getByRole('heading', { level: 1, name: 'Projeto' })).toBeVisible()
    expect(within(content).getByText(/Um parágrafo com/)).toBeVisible()
    expect(within(content).getAllByRole('list')).toHaveLength(2)
    expect(within(content).getByText('npm install').closest('pre')).not.toBeNull()
    expect(within(content).getByRole('table')).toBeVisible()
    expect(within(content).getByRole('cell', { name: 'valor' })).toBeVisible()
    expect(content.querySelector('script')).toBeNull()
    expect(content.querySelector('img')).not.toHaveAttribute('onerror')
    expect(within(content).getByRole('link', { name: 'link' })).toHaveAttribute('target', '_blank')
    expect(liveRegion(section)).toHaveTextContent(/^$/)
    expect(within(section).queryByTestId('readme-skeleton')).not.toBeInTheDocument()
  })

  it('absent: says so, without an alert or a button', () => {
    const { section } = renderReadme({ status: 'absent' })

    expect(within(section).getByText('Este repositório não tem README.')).toBeVisible()
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(section).queryByRole('button')).not.toBeInTheDocument()
    expect(liveRegion(section)).toHaveTextContent(/^$/)
  })

  it('rate-limited: the existing rate limit content with the release time, no button', () => {
    const { section } = renderReadme({ status: 'error', error: { kind: 'rate-limited', resetAt } })

    const alert = within(section).getByRole('alert')
    expect(within(alert).getByRole('heading', { level: 3, name: 'Limite de consultas atingido' })).toBeVisible()
    expect(alert).toHaveTextContent('As consultas voltam a ser liberadas às 14:05.')
    expect(within(section).queryByRole('button')).not.toBeInTheDocument()
  })

  it('rate-limited without a reset time: try later, no button', () => {
    const { section } = renderReadme({ status: 'error', error: { kind: 'rate-limited' } })

    expect(within(section).getByRole('alert')).toHaveTextContent('Tente de novo mais tarde.')
    expect(within(section).queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
    ['network', { kind: 'network' } as const, 'Sem conexão', 'Não foi possível conectar ao GitHub.'],
    ['unexpected', { kind: 'unexpected', status: 500 } as const, 'Algo deu errado', 'Não foi possível carregar o README.'],
  ])('retryable %s: the type message and "Tentar novamente", once per press', async (_kind, error, title, text) => {
    const { section, onRetry } = renderReadme({ status: 'error', error })

    const alert = within(section).getByRole('alert')
    expect(within(alert).getByRole('heading', { level: 3, name: title })).toBeVisible()
    expect(alert).toHaveTextContent(text)
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it.each<[string, Shown]>([
    ['loading', { status: 'loading' }],
    ['loaded', { status: 'success', html: readme }],
    ['absent', { status: 'absent' }],
    ['error', { status: 'error', error: { kind: 'network' } }],
  ])('tokens and spacing in the %s state', async (_name, result) => {
    const { container } = renderReadme(result)
    const rawClasses = usedClasses(container)
    const classes = withoutVariants(rawClasses)

    expect(usesToken(classes, ['bg', 'text', 'border'], tokensOf('color')), 'color').toBe(true)
    const { offScale } = await spacingReport(rawClasses)
    expect(offScale, 'spacing off the DESIGN.md scale').toEqual([])
  })
})
