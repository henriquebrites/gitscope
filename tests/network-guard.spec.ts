import { json } from './support/github.js'
import { expect, test } from './support/test.js'

test('unrouted request fails the test', async ({ page }) => {
  test.fail(true, 'the guard must fail a test whose request no page.route intercepted')
  await page.goto('/')
  await page.evaluate(() => fetch('https://api.github.com/users/octocat').catch(() => undefined))
})

test('routed request passes', async ({ page }) => {
  await page.route('https://api.github.com/users/octocat', (route) => json(route, { login: 'octocat' }))
  await page.goto('/')

  const login = await page.evaluate(() =>
    fetch('https://api.github.com/users/octocat').then((response) => response.json() as Promise<{ login: string }>),
  )

  expect(login).toEqual({ login: 'octocat' })
})
