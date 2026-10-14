import type { Page } from '@playwright/test'
import { expect, test } from './support/test.js'
import { expectPage } from './support/pager.js'
import { expectFocusRing, expectVisualTabOrder, tabThrough } from './support/focus.js'
import {
  json,
  pagedRepositories,
  repositoriesOf,
  repositoryOf,
  stubGitHub,
  stubRepository,
  type RepositoryHandler,
} from './support/github.js'

const mobile = { width: 320, height: 480 }
const desktop = { width: 1280, height: 800 }

// No spaces or hyphens: only `break-words` can keep these inside 320 px.
const longName = 'repositorio'.repeat(10)
const longText = 'descricao'.repeat(35)

interface DetailState {
  name: string
  handler: RepositoryHandler
  /** Heading that tells the state has rendered. */
  heading: string
}

const states: DetailState[] = [
  {
    name: 'long name and description',
    handler: (route) => json(route, repositoryOf(longName, { description: longText })),
    heading: longName,
  },
  {
    name: 'null description and language',
    handler: (route) => json(route, repositoryOf('sem-dados', { description: null, language: null })),
    heading: 'sem-dados',
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

test('from the list: no repository request, and back to the same sort and page', async ({ page }) => {
  const users = await stubGitHub(page, undefined, pagedRepositories(repositoriesOf('r', 45)))
  const repositories = await stubRepository(page)

  await page.goto('/users/octocat?sort=name-asc&page=2')
  const list = page.getByRole('region', { name: 'Repositórios' })
  await expectPage(page, list, 2, 2)
  await list.getByRole('link', { name: 'r-031' }).click()

  await expect(page).toHaveURL('/users/octocat/repos/r-031')
  await expect(page.getByRole('heading', { level: 1, name: 'r-031' })).toBeVisible()
  expect(repositories).toEqual([])

  await page.getByRole('link', { name: 'Voltar aos repositórios' }).click()

  await expect(page).toHaveURL('/users/octocat?sort=name-asc&page=2')
  await expectPage(page, list, 2, 2)
  expect(repositories).toEqual([])
  expect(users).toEqual(['octocat'])
})
