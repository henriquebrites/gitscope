import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { spacingReport } from '../test/spacing'
import { appliedClasses, tokensOf } from '../test/theme'
import App from './App'

function usedClasses(container: HTMLElement): string[] {
  return [container, ...container.querySelectorAll('*')].flatMap((element) => [
    ...element.classList,
  ])
}

// Token checks compare the utility itself, so responsive and state variants are dropped.
function withoutVariants(classes: string[]): string[] {
  return classes.map((name) => name.replace(/^(?:[^[\]():]+:)+/, ''))
}

function usesToken(classes: string[], prefixes: string[], tokens: string[]): boolean {
  return classes.some((name) =>
    prefixes.some((prefix) => tokens.some((token) => name === `${prefix}-${token}`)),
  )
}

describe('App', () => {
  it('renders the home heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
  })

  it('uses a token from every group', async () => {
    const { container } = render(<App />)
    const rawClasses = usedClasses(container)
    const classes = withoutVariants(rawClasses)

    expect(usesToken(classes, ['bg', 'text', 'border'], tokensOf('color')), 'color').toBe(true)
    expect(usesToken(classes, ['text'], tokensOf('text')), 'typography').toBe(true)
    expect(usesToken(classes, ['font'], tokensOf('font')), 'font family').toBe(true)
    const { spacing, offScale } = await spacingReport([...rawClasses, ...appliedClasses])
    expect(spacing.length, 'spacing').toBeGreaterThan(0)
    expect(offScale, 'spacing off the DESIGN.md scale').toEqual([])
    expect(usesToken(classes, ['rounded'], tokensOf('radius')), 'radius').toBe(true)
  })
})
