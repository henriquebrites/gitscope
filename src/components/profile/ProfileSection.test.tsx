import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { ProfileResult } from '../../hooks/useProfile'
import type { GitHubError } from '../../services/githubApi'
import { usedClasses, usesToken, withoutVariants } from '../../test/classes'
import { octocat } from '../../test/github'
import { spacingReport } from '../../test/spacing'
import { tokensOf } from '../../test/theme'
import ProfileSection from './ProfileSection'

function renderSection(result: ProfileResult) {
  const view = render(
    <MemoryRouter>
      <ProfileSection result={result} login="octocat" onRetry={() => {}} />
    </MemoryRouter>,
  )
  return { ...view, section: screen.getByRole('region', { name: 'Perfil' }) }
}

const errors: [string, GitHubError, string][] = [
  ['not-found', { kind: 'not-found' }, 'Conta não encontrada'],
  ['network', { kind: 'network' }, 'Sem conexão'],
  ['rate-limited', { kind: 'rate-limited', resetAt: new Date(2026, 9, 12, 14, 5) }, 'Limite de consultas atingido'],
  ['unexpected', { kind: 'unexpected', status: 500 }, 'Algo deu errado'],
]

const states: [string, ProfileResult][] = [
  ['loading', { status: 'loading' }],
  ['success', { status: 'success', profile: octocat }],
  ['null fields', { status: 'success', profile: { ...octocat, name: null, bio: null, email: null } }],
  ...errors.map(([name, error]): [string, ProfileResult] => [name, { status: 'error', error }]),
]

function liveRegion(section: HTMLElement) {
  const region = section.querySelector('[aria-live]')
  expect(region).not.toBeNull()
  return region as HTMLElement
}

describe('ProfileSection', () => {
  it('loading shows the skeleton in the profile area and announces it politely', () => {
    const { section } = renderSection({ status: 'loading' })

    expect(within(section).getByTestId('profile-skeleton')).toBeInTheDocument()
    const region = liveRegion(section)
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('Carregando perfil…')
    expect(within(section).queryByRole('heading')).not.toBeInTheDocument()
  })

  it('outside loading the live region is empty and there is no skeleton', () => {
    const { section } = renderSection({ status: 'success', profile: octocat })

    expect(liveRegion(section)).toHaveTextContent(/^$/)
    expect(within(section).queryByTestId('profile-skeleton')).not.toBeInTheDocument()
    expect(within(section).getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
  })

  it.each(errors)('shows the %s error in the profile area, in an alert with a text title', (_kind, error, title) => {
    const { section } = renderSection({ status: 'error', error })

    const alert = within(section).getByRole('alert')
    expect(within(alert).getByRole('heading', { name: title })).toBeVisible()
    expect(within(section).queryByTestId('profile-skeleton')).not.toBeInTheDocument()
    expect(liveRegion(section)).toHaveTextContent(/^$/)
  })

  it.each(states)('spacing and tokens in the %s state', async (_name, result) => {
    const { container } = renderSection(result)
    const rawClasses = usedClasses(container)
    const classes = withoutVariants(rawClasses)

    expect(usesToken(classes, ['bg', 'text', 'border'], tokensOf('color')), 'color').toBe(true)
    expect(usesToken(classes, ['text'], tokensOf('text')), 'typography').toBe(true)
    // Typography comes only from DESIGN.md tokens: no stock sizes, weights or tracking on top.
    const stockTypography = classes.filter((name) =>
      /^(?:text-(?:xs|sm|base|lg|[2-9]?xl)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|tracking-|leading-)/.test(name),
    )
    expect(stockTypography, 'typography off the DESIGN.md tokens').toEqual([])
    const { spacing, offScale } = await spacingReport(rawClasses)
    expect(spacing.length, 'spacing').toBeGreaterThan(0)
    expect(offScale, 'spacing off the DESIGN.md scale').toEqual([])
  })
})
