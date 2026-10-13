import { expect, test, type Page } from '@playwright/test'
import { expectFocusRing, expectVisualTabOrder, tabThrough } from './support/focus.js'
import { json, octocat, stubGitHub, type UserHandler } from './support/github.js'

const mobile = { width: 320, height: 480 }
const desktop = { width: 1280, height: 800 }

const longText = 'Desenvolvedora-de-software-com-um-nome-de-palavra-unica-muito-comprida '.repeat(4)

interface ProfileState {
  name: string
  handler: UserHandler
  /** Heading that tells the state has rendered. */
  heading: string
}

const states: ProfileState[] = [
  {
    name: 'full profile with long texts',
    handler: (route, login) =>
      json(route, {
        ...octocat,
        login,
        name: longText,
        bio: longText,
        email: 'endereco-de-email-bastante-longo-para-testar@exemplo-de-dominio.com.br',
      }),
    heading: 'octocat',
  },
  {
    name: 'null fields',
    handler: (route, login) => json(route, { ...octocat, login, name: null, bio: null, email: null }),
    heading: 'octocat',
  },
  {
    name: 'not-found',
    handler: (route) => json(route, { message: 'Not Found' }, 404),
    heading: 'Conta não encontrada',
  },
  {
    name: 'network',
    handler: (route) => route.abort('internetdisconnected'),
    heading: 'Sem conexão',
  },
  {
    name: 'rate-limited',
    handler: (route) =>
      json(route, { message: 'API rate limit exceeded' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600),
      }),
    heading: 'Limite de consultas atingido',
  },
  {
    name: 'unexpected',
    handler: (route) => json(route, { message: 'Server Error' }, 500),
    heading: 'Algo deu errado',
  },
]

async function openState(page: Page, state: ProfileState) {
  await stubGitHub(page, state.handler)
  await page.goto('/users/octocat')
  await expect(
    page.getByRole('region', { name: 'Perfil' }).getByRole('heading', { level: 1, name: state.heading }),
  ).toBeVisible()
}

for (const state of states) {
  test.describe(`profile: ${state.name}`, () => {
    test('no horizontal scroll at 320', async ({ page }) => {
      await page.setViewportSize(mobile)
      await openState(page, state)

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(320)
    })

    for (const viewport of [mobile, desktop]) {
      test(`focus ring and tab order at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await openState(page, state)

        const visited = await tabThrough(page)
        expect(visited.some((element) => element.region === 'main')).toBe(
          state.name !== 'rate-limited',
        )
        expectFocusRing(visited)
        expectVisualTabOrder(visited)
      })
    }
  })
}

test('loading: skeleton in the profile area, no horizontal scroll at 320', async ({ page }) => {
  await page.setViewportSize(mobile)
  await stubGitHub(page, () => new Promise<void>(() => {}))
  await page.goto('/users/octocat')

  const area = page.getByRole('region', { name: 'Perfil' })
  await expect(area.getByTestId('profile-skeleton')).toBeVisible()
  await expect(area.locator('[aria-live="polite"]')).toHaveText('Carregando perfil…')
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(320)
})

test('refresh refetches the profile: the cache lives only in memory', async ({ page }) => {
  const users = await stubGitHub(page)

  await page.goto('/users/octocat')
  await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
  expect(users).toEqual(['octocat'])

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
  expect(users).toEqual(['octocat', 'octocat'])
})

test('a profile visited in the session opens without a new request', async ({ page }) => {
  const users = await stubGitHub(page)
  const search = page.getByRole('banner').getByRole('textbox', { name: 'Nome de usuário do GitHub' })

  await page.goto('/users/octocat')
  await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()
  await search.fill('other')
  await search.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'other' })).toBeVisible()
  await search.fill('OctoCat')
  await search.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()

  expect(users).toEqual(['octocat', 'other'])
})

test('requests go only to the GitHub API, without credentials', async ({ page }) => {
  await stubGitHub(page)
  const apiRequests: { url: string; authorization: string | undefined }[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('https://api.github.com/')) {
      apiRequests.push({ url: request.url(), authorization: request.headers().authorization })
    }
  })

  await page.goto('/users/octocat')
  await expect(page.getByRole('heading', { level: 1, name: 'octocat' })).toBeVisible()

  expect(apiRequests).toEqual([{ url: 'https://api.github.com/users/octocat', authorization: undefined }])
})
