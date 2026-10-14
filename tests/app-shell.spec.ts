import type { Page } from '@playwright/test'
import { expect, test } from './support/test.js'
import { stubGitHub } from './support/github.js'
import { expectFocusRing, expectVisualTabOrder, tabThrough } from './support/focus.js'

const screens = ['/', '/users/octocat', '/users/octocat/repos/hello-world', '/foo/bar']

const mobile = { width: 320, height: 480 }
const desktop = { width: 1280, height: 800 }

/** Every screen has a level-1 heading once its content is in; loading has none. */
async function gotoScreen(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()
}

// The profile route requests its user; the API is always simulated.
test.beforeEach(async ({ page }) => {
  await stubGitHub(page)
})

for (const path of screens) {
  test.describe(`screen ${path}`, () => {
    test('no horizontal scroll at 320', async ({ page }) => {
      await page.setViewportSize(mobile)
      await gotoScreen(page, path)
      await expect(page.getByRole('banner')).toBeVisible()

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(320)
    })

    test('stacks header above content at 320', async ({ page }) => {
      await page.setViewportSize(mobile)
      await gotoScreen(page, path)

      const header = await page.getByRole('banner').boundingBox()
      const main = await page.getByRole('main').boundingBox()
      expect(header && main).toBeTruthy()
      expect(header!.y + header!.height).toBeLessThanOrEqual(main!.y)
    })

    for (const viewport of [{ width: 1024, height: 768 }, desktop]) {
      test(`caps the content width at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await gotoScreen(page, path)

        const box = await page.getByRole('main').boundingBox()
        expect(box).toBeTruthy()
        expect(box!.width).toBeGreaterThan(0)
        expect(box!.width).toBeLessThanOrEqual(768)
      })
    }

    for (const viewport of [mobile, desktop]) {
      test(`focus ring on every focusable at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await gotoScreen(page, path)

        const visited = await tabThrough(page)
        expect(visited.length).toBeGreaterThanOrEqual(3)
        expectFocusRing(visited)
      })

      test(`tab order follows visual order at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await gotoScreen(page, path)

        expectVisualTabOrder(await tabThrough(page))
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
