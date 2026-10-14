import type { Locator, Page } from '@playwright/test'
import { stubGitHub } from './support/github.js'
import { expect, test } from './support/test.js'

const otherRoutes = ['/users/octocat', '/users/octocat/repos/Hello-World', '/foo/bar']

const banner = (page: Page) => page.getByRole('banner')

async function box(locator: Locator) {
  const value = await locator.boundingBox()
  expect(value, String(locator)).toBeTruthy()
  return value!
}

const middle = (value: { y: number; height: number }) => value.y + value.height / 2

test.beforeEach(async ({ page }) => {
  await stubGitHub(page)
})

for (const path of otherRoutes) {
  for (const width of [640, 1280]) {
    test(`one row at ${width} (${path})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(path)
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()

      const parts = [
        banner(page).getByRole('link', { name: 'GitHub Explorer' }),
        banner(page).getByRole('textbox', { name: 'Nome de usuário do GitHub' }),
        banner(page).getByRole('button', { name: 'Buscar' }),
        banner(page).getByRole('button', { name: 'Usar tema escuro' }),
      ]
      const boxes = await Promise.all(parts.map(box))
      // Same row: every part crosses the wordmark's vertical middle; left to right in this order.
      for (const part of boxes) {
        expect(part.y).toBeLessThan(middle(boxes[0]))
        expect(part.y + part.height).toBeGreaterThan(middle(boxes[0]))
      }
      for (let index = 1; index < boxes.length; index += 1) {
        expect(boxes[index].x).toBeGreaterThan(boxes[index - 1].x)
      }
      // Kept for screen readers only: clipped to a 1px box.
      const hint = await banner(page).getByText('Use o login exato da conta, por exemplo octocat.').boundingBox()
      expect(hint === null || (hint.width <= 1 && hint.height <= 1)).toBe(true)
    })
  }

  for (const width of [320, 639]) {
    test(`two rows at ${width} (${path})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 480 })
      await page.goto(path)
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()

      const brand = await box(banner(page).getByRole('link', { name: 'GitHub Explorer' }))
      const theme = await box(banner(page).getByRole('button', { name: 'Usar tema escuro' }))
      const field = await box(banner(page).getByRole('textbox', { name: 'Nome de usuário do GitHub' }))
      const search = await box(banner(page).getByRole('button', { name: 'Buscar' }))

      expect(theme.y).toBeLessThan(middle(brand))
      expect(theme.y + theme.height).toBeGreaterThan(middle(brand))
      expect(theme.x).toBeGreaterThan(brand.x)
      expect(field.y).toBeGreaterThanOrEqual(Math.max(brand.y + brand.height, theme.y + theme.height))
      expect(search.y).toBeGreaterThanOrEqual(theme.y + theme.height)
    })
  }
}

for (const [place, path] of [
  ['hero', '/'],
  ['header', '/foo/bar'],
] as const) {
  test(`blank search message sits under the field (${place})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const apiCalls: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).hostname === 'api.github.com') apiCalls.push(request.url())
    })
    await page.goto(path)
    const search = page.getByRole('search')
    const field = search.getByRole('textbox', { name: 'Nome de usuário do GitHub' })

    await field.fill('   ')
    await field.press('Enter')

    const message = search.getByText('Digite um nome de usuário para buscar.')
    await expect(message).toBeVisible()
    await expect(field).toBeFocused()
    await expect(page).toHaveURL(path)
    const row = await box(search.getByTestId('search-row'))
    const text = await box(message)
    expect(text.y).toBeGreaterThanOrEqual(row.y + row.height)
    expect(text.y - (row.y + row.height)).toBeLessThanOrEqual(8)
    expect(apiCalls).toEqual([])
  })
}
