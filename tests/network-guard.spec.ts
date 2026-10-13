import { json } from './support/github.js'
import { expect, test } from './support/test.js'

const leaked = 'https://api.github.com/users/octocat'

test('unrouted request is aborted and recorded', async ({ page, unroutedRequests }) => {
  await page.goto('/')

  const outcome = await page.evaluate(
    (url) => fetch(url).then(() => 'answered', () => 'aborted'),
    leaked,
  )

  expect(outcome).toBe('aborted')
  expect(unroutedRequests).toEqual([leaked])
  // Emptied so that only the next spec exercises the teardown failure.
  unroutedRequests.length = 0
})

test('unrouted request fails the test', async ({ page }) => {
  test.fail(true, 'the guard must fail a test whose request no page.route intercepted')
  await page.goto('/')
  await page.evaluate((url) => fetch(url).catch(() => undefined), leaked)
})

test('routed request passes', async ({ page }) => {
  await page.route(leaked, (route) => json(route, { login: 'octocat' }))
  await page.goto('/')

  const login = await page.evaluate((url) => fetch(url).then((response) => response.json() as Promise<{ login: string }>), leaked)

  expect(login).toEqual({ login: 'octocat' })
})
