import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { tokensOf } from '../test/theme'
import App from './App'

function usedClasses(container: HTMLElement): string[] {
  return [container, ...container.querySelectorAll('*')].flatMap((element) =>
    [...element.classList].map((name) => name.replace(/^.*:/, '')),
  )
}

function usesToken(classes: string[], prefixes: string[], tokens: string[]): boolean {
  return classes.some((name) =>
    prefixes.some((prefix) => tokens.some((token) => name === `${prefix}-${token}`)),
  )
}

// DESIGN.md spacing steps on the 4px base: xxs 1, xs 2, sm 3, md 4, lg 6, xl 8, 2xl 10,
// 3xl 16, 4xl 24, section 32.
const designSpacingSteps = new Set(['1', '2', '3', '4', '6', '8', '10', '16', '24', '32', 'auto'])
const spacingClass = /^-?(?:[pm][xytrbl]?|gap(?:-[xy])?|space-[xy])-(.+)$/

describe('App', () => {
  it('renders the home heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
  })

  it('uses a token from every group', () => {
    const { container } = render(<App />)
    const classes = usedClasses(container)

    expect(usesToken(classes, ['bg', 'text', 'border'], tokensOf('color')), 'color').toBe(true)
    expect(usesToken(classes, ['text'], tokensOf('text')), 'typography').toBe(true)
    expect(usesToken(classes, ['font'], tokensOf('font')), 'font family').toBe(true)
    const spacingSteps = classes.flatMap((name) => name.match(spacingClass)?.[1] ?? [])
    expect(spacingSteps.length, 'spacing').toBeGreaterThan(0)
    expect(spacingSteps.filter((step) => !designSpacingSteps.has(step)), 'spacing').toEqual([])
    expect(usesToken(classes, ['rounded'], tokensOf('radius')), 'radius').toBe(true)
  })
})
