import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usedClasses, usesToken, withoutVariants } from '../test/classes'
import { spacingReport } from '../test/spacing'
import { appliedClasses, tokensOf } from '../test/theme'
import App from './App'

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
