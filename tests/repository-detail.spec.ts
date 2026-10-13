import { expect, test, type Page } from '@playwright/test'
import { expectFocusRing, expectVisualTabOrder, tabThrough } from './support/focus.js'
import { json, repositoryOf, stubGitHub, stubRepository, type RepositoryHandler } from './support/github.js'

const mobile = { width: 320, height: 480 }
const desktop = { width: 1280, height: 800 }

const longName = 'repositorio-com-um-nome-de-uma-unica-palavra-extremamente-comprido-para-quebrar'
const longText = 'Descricao-de-repositorio-com-uma-unica-palavra-muito-comprida-sem-espacos '.repeat(4)

interface DetailState {
  name: string
  handler: RepositoryHandler
  /** Heading that tells the state has rendered. */
  heading: string
}

const states: DetailState[] = [
  {
    name: 'long name and description',
    handler: (route, owner) => json(route, { ...repositoryOf(owner, longName), description: longText }),
    heading: longName,
  },
  {
    name: 'not-found',
    handler: (route) => json(route, { message: 'Not Found' }, 404),
    heading: 'Repositório não encontrado',
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

async function openState(page: Page, state: DetailState) {
  await stubGitHub(page)
  await stubRepository(page, state.handler)
  await page.goto(`/users/octocat/repos/${longName}`)
  await expect(
    page.getByRole('region', { name: 'Repositório' }).getByRole('heading', { level: 1, name: state.heading }),
  ).toBeVisible()
}

async function scrollWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth)
}

for (const state of states) {
  test.describe(`detail: ${state.name}`, () => {
    test('no horizontal scroll at 320', async ({ page }) => {
      await page.setViewportSize(mobile)
      await openState(page, state)

      expect(await scrollWidth(page)).toBeLessThanOrEqual(320)
    })

    for (const viewport of [mobile, desktop]) {
      test(`focus ring and tab order at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await openState(page, state)

        const visited = await tabThrough(page)
        expect(visited.map((element) => element.label)).toContain('a ← Voltar aos repositórios')
        expectFocusRing(visited)
        expectVisualTabOrder(visited)
      })
    }
  })
}

test('loading: no horizontal scroll at 320, skeleton in the detail area', async ({ page }) => {
  await page.setViewportSize(mobile)
  await stubGitHub(page)
  await stubRepository(page, () => new Promise<void>(() => {}))
  await page.goto(`/users/octocat/repos/${longName}`)

  const area = page.getByRole('region', { name: 'Repositório' })
  await expect(area.getByTestId('repository-skeleton')).toBeVisible()
  await expect(area.locator('[aria-live="polite"]')).toHaveText('Carregando repositório…')
  expect(await scrollWidth(page)).toBeLessThanOrEqual(320)
})

test('refresh refetches the repository: the cache lives only in memory', async ({ page }) => {
  await stubGitHub(page)
  const repositories = await stubRepository(page)

  await page.goto('/users/octocat/repos/Hello-World')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
  expect(repositories).toEqual(['octocat/Hello-World'])

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Hello-World' })).toBeVisible()
  expect(repositories).toEqual(['octocat/Hello-World', 'octocat/Hello-World'])
})
