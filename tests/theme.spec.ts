import type { Page } from '@playwright/test'
import { darkFocusColor, expectFocusRing, focusColor, tabThrough } from './support/focus.js'
import { pagedRepositories, repositoriesOf, stubGitHub } from './support/github.js'
import { expect, test } from './support/test.js'

const routes = ['/', '/users/octocat', '/foo/bar']

const toggle = (page: Page) => page.getByRole('button', { name: /^Usar tema (claro|escuro)$/ })
const rootTheme = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'))

interface FirstFrame {
  theme: string | null
  canvas: string
}

/**
 * Records the theme in the first animation frame, which runs before the first paint: the
 * applied attribute and the canvas token the stylesheet resolves for it.
 */
async function recordFirstFrame(page: Page) {
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      const root = document.documentElement
      ;(window as unknown as { firstFrame: FirstFrame }).firstFrame = {
        theme: root.getAttribute('data-theme'),
        canvas: getComputedStyle(root).getPropertyValue('--color-canvas').trim(),
      }
    })
  })
}

const firstFrame = (page: Page) =>
  page.waitForFunction(() => (window as unknown as { firstFrame?: FirstFrame }).firstFrame).then((handle) =>
    handle.jsonValue() as Promise<FirstFrame>,
  )

const canvas = { light: '#fafafa', dark: '#0a0a0a' }

test.beforeEach(async ({ page }) => {
  await stubGitHub(page)
})

for (const path of routes) {
  test(`system light opens light (${path})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto(path)

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(toggle(page)).toHaveAccessibleName('Usar tema escuro')
  })

  test(`system dark opens dark before first paint (${path})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await recordFirstFrame(page)
    await page.goto(path)

    expect(await firstFrame(page)).toEqual({ theme: 'dark', canvas: canvas.dark })
    await expect(toggle(page)).toHaveAccessibleName('Usar tema claro')
  })

  for (const [stored, system] of [
    ['dark', 'light'],
    ['light', 'dark'],
  ] as const) {
    test(`stored choice wins before first paint: ${stored} over system ${system} (${path})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: system })
      await page.addInitScript((theme) => localStorage.setItem('github-explorer:theme', theme), stored)
      await recordFirstFrame(page)
      await page.goto(path)

      expect(await firstFrame(page)).toEqual({ theme: stored, canvas: canvas[stored] })
      await page.reload()
      expect(await firstFrame(page)).toEqual({ theme: stored, canvas: canvas[stored] })
    })
  }
}

test('the theme is applied before the app script runs', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/assets/*.js', async (route) => {
    await held
    await route.continue()
  })
  await page.goto('/', { waitUntil: 'commit' })

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.locator('#root').innerHTML()).toBe('')
  release()
  await expect(toggle(page)).toHaveAccessibleName('Usar tema claro')
})

test('toggle by click, Enter and Space', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/users/octocat')
  await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
  await page.evaluate(() => ((window as unknown as { sameDocument: boolean }).sameDocument = true))
  const stored = () => page.evaluate(() => localStorage.getItem('github-explorer:theme'))

  await toggle(page).click()
  expect(await rootTheme(page)).toBe('dark')
  expect(await stored()).toBe('dark')
  await expect(toggle(page)).toHaveAccessibleName('Usar tema claro')
  await expect(toggle(page)).toBeFocused()

  await page.keyboard.press('Enter')
  expect(await rootTheme(page)).toBe('light')
  expect(await stored()).toBe('light')
  await expect(toggle(page)).toHaveAccessibleName('Usar tema escuro')
  await expect(toggle(page)).toBeFocused()

  await page.keyboard.press('Space')
  expect(await rootTheme(page)).toBe('dark')
  expect(await stored()).toBe('dark')
  await expect(toggle(page)).toBeFocused()

  // No reload happened: the marker set on this document is still there.
  expect(await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument)).toBe(true)
})

test('follows the system only without a stored choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await toggle(page).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.emulateMedia({ colorScheme: 'light' })
  // Give a system listener the chance it would need to act, then confirm nothing changed.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))))
  expect(await rootTheme(page)).toBe('dark')
})

test('blocked storage: system theme, the toggle still works, no error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage is blocked', 'SecurityError')
      },
    })
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/users/octocat')
  await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await toggle(page).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(toggle(page)).toHaveAccessibleName('Usar tema escuro')
  await toggle(page).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(errors).toEqual([])
})

test.describe('both themes', () => {
  const screens: [string, string, (page: Page) => Promise<void>][] = [
    ['home', '/', async () => {}],
    [
      'profile with list',
      '/users/octocat',
      (page) => stubGitHub(page, undefined, pagedRepositories(repositoriesOf('repositorio-de-nome-longo', 45))).then(() => {}),
    ],
    ['detail with README', '/users/octocat/repos/Hello-World', async () => {}],
    ['not found', '/foo/bar', async () => {}],
  ]

  for (const theme of ['light', 'dark'] as const) {
    for (const viewport of [
      { width: 320, height: 480 },
      { width: 1280, height: 800 },
    ]) {
      for (const [name, path, stub] of screens) {
        test(`both themes: ${theme}, ${viewport.width}, ${name}`, async ({ page }) => {
          await stub(page)
          await page.setViewportSize(viewport)
          await page.emulateMedia({ colorScheme: theme })
          await page.goto(path)
          await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()
          if (name === 'profile with list') {
            await expect(page.getByRole('navigation', { name: 'Páginas de repositórios' })).toBeVisible()
          }
          if (name === 'detail with README') {
            await expect(page.getByRole('heading', { level: 2, name: 'Hello World' })).toBeVisible()
          }
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
          expect(scrollWidth).toBeLessThanOrEqual(viewport.width)
          const visited = await tabThrough(page, 60)
          expect(visited.length).toBeGreaterThanOrEqual(3)
          expectFocusRing(visited, theme === 'dark' ? darkFocusColor : focusColor)
        })
      }
    }
  }
})
