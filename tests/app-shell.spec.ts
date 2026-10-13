import { expect, test, type Page } from '@playwright/test'

const screens = ['/', '/users/octocat', '/users/octocat/repos/hello-world', '/foo/bar']
const focusColor = 'rgb(7, 97, 209)'

const mobile = { width: 320, height: 480 }
const desktop = { width: 1280, height: 800 }

interface Focused {
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
async function tabThrough(page: Page): Promise<Focused[]> {
  const visited: Focused[] = []
  for (let step = 0; step < 30; step += 1) {
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

for (const path of screens) {
  test.describe(`screen ${path}`, () => {
    test('no horizontal scroll at 320', async ({ page }) => {
      await page.setViewportSize(mobile)
      await page.goto(path)
      await expect(page.getByRole('banner')).toBeVisible()

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(320)
    })

    test('stacks header above content at 320', async ({ page }) => {
      await page.setViewportSize(mobile)
      await page.goto(path)

      const header = await page.getByRole('banner').boundingBox()
      const main = await page.getByRole('main').boundingBox()
      expect(header && main).toBeTruthy()
      expect(header!.y + header!.height).toBeLessThanOrEqual(main!.y)
    })

    for (const viewport of [{ width: 1024, height: 768 }, desktop]) {
      test(`caps the content width at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto(path)

        const box = await page.getByRole('main').boundingBox()
        expect(box).toBeTruthy()
        expect(box!.width).toBeGreaterThan(0)
        expect(box!.width).toBeLessThanOrEqual(768)
      })
    }

    for (const viewport of [mobile, desktop]) {
      test(`focus ring on every focusable at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto(path)

        const visited = await tabThrough(page)
        expect(visited.length).toBeGreaterThanOrEqual(3)
        for (const element of visited) {
          expect(element.outlineStyle, element.label).toBe('solid')
          expect(element.outlineWidth, element.label).toBeGreaterThanOrEqual(2)
          expect(element.outlineColor, element.label).toBe(focusColor)
        }
      })

      test(`tab order follows visual order at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto(path)

        const visited = await tabThrough(page)
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
      })
    }
  })
}

test('unknown route shows not found and calls no API', async ({ page }) => {
  const apiCalls: string[] = []
  await page.route('https://api.github.com/**', (route) => {
    apiCalls.push(route.request().url())
    return route.abort()
  })

  await page.goto('/foo/bar')

  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
  const home = page.getByRole('main').getByRole('link', { name: 'Voltar ao início' })
  await expect(home).toHaveAttribute('href', '/')
  await home.click()
  await expect(page).toHaveURL('/')
  expect(apiCalls).toEqual([])
})
