import { expect, test } from './support/test.js'

const localHosts = new Set(['localhost', '127.0.0.1'])

test('opens the home page', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('no external requests when opening the home page', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (request) => requested.push(request.url()))

  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  const external = requested.filter((url) => !localHosts.has(new URL(url).hostname))
  expect(external).toEqual([])
  expect(requested.some((url) => url.endsWith('.woff2'))).toBe(true)
  const loadedFamilies = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family),
  )
  expect(loadedFamilies.map((family) => family.replace(/["']/g, ''))).toEqual(
    expect.arrayContaining(['Geist Variable', 'Geist Mono Variable']),
  )
})
