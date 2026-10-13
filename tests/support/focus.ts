import { expect, type Page } from '@playwright/test'

export const focusColor = 'rgb(7, 97, 209)'

export interface Focused {
  label: string
  region: 'header' | 'main' | 'other'
  top: number
  bottom: number
  left: number
  outlineStyle: string
  outlineWidth: number
  outlineColor: string
}

/** Presses Tab until focus leaves the page, recording every element that received focus. */
export async function tabThrough(page: Page, maxSteps = 30): Promise<Focused[]> {
  const visited: Focused[] = []
  for (let step = 0; step < maxSteps; step += 1) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate((): Focused | null => {
      const element = document.activeElement
      if (!element || element === document.body) return null
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return {
        label: `${element.tagName.toLowerCase()} ${element.textContent?.trim() ?? ''}`.trim(),
        region: element.closest('header') ? 'header' : element.closest('main') ? 'main' : 'other',
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        left: rect.left,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineColor: style.outlineColor,
      }
    })
    if (!focused) break
    if (visited.some((seen) => seen.label === focused.label && seen.top === focused.top)) break
    visited.push(focused)
  }
  return visited
}

/** Header before main, and each stop right of the previous on its row or on a row below. */
export function expectVisualTabOrder(visited: Focused[]) {
  const regions = visited.map((element) => element.region)
  expect(regions).not.toContain('other')
  expect(regions.slice(regions.indexOf('main') === -1 ? regions.length : regions.indexOf('main'))).not.toContain('header')
  expect(regions[0]).toBe('header')

  for (let index = 1; index < visited.length; index += 1) {
    const previous = visited[index - 1]
    const current = visited[index]
    const sameRow = current.top < previous.bottom && previous.top < current.bottom
    if (sameRow) expect(current.left, current.label).toBeGreaterThan(previous.left)
    else expect(current.top, current.label).toBeGreaterThan(previous.top)
  }
}

/** Every Tab stop shows the solid 2px focus ring in the focus token colour. */
export function expectFocusRing(visited: Focused[]) {
  for (const element of visited) {
    expect(element.outlineStyle, element.label).toBe('solid')
    expect(element.outlineWidth, element.label).toBeGreaterThanOrEqual(2)
    expect(element.outlineColor, element.label).toBe(focusColor)
  }
}
