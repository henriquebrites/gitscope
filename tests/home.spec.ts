import type { Page } from '@playwright/test'
import { stubGitHub } from './support/github.js'
import { expect, localHosts, test } from './support/test.js'

const avatarHost = 'avatars.githubusercontent.com'

function intersects(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

const hero = (page: Page) => page.getByRole('main')

test('opens the home page', async ({ page }) => {
  await stubGitHub(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('only the three avatars leave the machine when opening the home page', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (request) => requested.push(request.url()))
  await stubGitHub(page)

  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(hero(page).getByRole('link', { name: 'gaearon' }).locator('img')).toHaveJSProperty('complete', true)

  const external = requested.filter((url) => !localHosts.has(new URL(url).hostname))
  expect(external.map((url) => new URL(url).hostname)).toEqual([avatarHost, avatarHost, avatarHost])
  expect(external.some((url) => new URL(url).hostname === 'api.github.com')).toBe(false)
  expect(requested.some((url) => url.endsWith('.woff2'))).toBe(true)
  const loadedFamilies = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family),
  )
  expect(loadedFamilies.map((family) => family.replace(/["']/g, ''))).toEqual(
    expect.arrayContaining(['Geist Variable', 'Geist Mono Variable']),
  )
})

for (const viewport of [
  { width: 320, height: 480 },
  { width: 1280, height: 800 },
]) {
  test(`glow overlaps nothing but the title at ${viewport.width}`, async ({ page }) => {
    await stubGitHub(page)
    await page.setViewportSize(viewport)
    await page.goto('/')

    const glow = await page.getByTestId('hero-glow').boundingBox()
    const title = await page.getByRole('heading', { level: 1 }).boundingBox()
    expect(glow && title).toBeTruthy()
    expect(intersects(glow!, title!)).toBe(true)
    const others = [
      page.getByText('Perfil público, todos os repositórios ordenados e o README de cada projeto.'),
      hero(page).getByRole('search'),
      page.getByText('Experimente'),
      page.getByRole('list', { name: 'Experimente' }),
    ]
    for (const other of others) {
      const box = await other.boundingBox()
      expect(box, String(other)).toBeTruthy()
      expect(intersects(glow!, box!), String(other)).toBe(false)
    }
  })
}

test('broken avatar keeps the login', async ({ page }) => {
  await stubGitHub(page)
  // Registered last, so it wins over the avatar stub: every avatar fails.
  await page.route(`https://${avatarHost}/**`, (route) => route.fulfill({ status: 404, body: '' }))
  await page.goto('/')

  for (const login of ['octocat', 'torvalds', 'gaearon']) {
    const link = hero(page).getByRole('link', { name: login, exact: true })
    await expect(link).toBeVisible()
    await expect(link).toHaveText(login)
  }
  await hero(page).getByRole('link', { name: 'torvalds' }).click()
  await expect(page).toHaveURL('/users/torvalds')
})
